import { Plugin } from "@opencode/plugin"

function parseModel(value) {
  if (typeof value !== "string") throw new Error("model must be a provider/model string, optionally followed by #variant")
  const [providerID, ...rest] = value.split("/")
  const modelWithVariant = rest.join("/")
  const hash = modelWithVariant.lastIndexOf("#")
  const id = hash < 0 ? modelWithVariant : modelWithVariant.slice(0, hash)
  const variant = hash < 0 ? undefined : modelWithVariant.slice(hash + 1)
  if (!providerID || !id || (hash >= 0 && !variant)) throw new Error(`Invalid model reference: ${value}`)
  return { providerID, id, variant }
}

export default Plugin.define({
  id: "integral-model-switch",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "set_integral_phase",
        description: "Switch the current Integral session to the model and reasoning variant assigned to a project task phase in its AGENTS.md. Use only for the Integral agent.",
        input: {
          type: "object",
          properties: {
            phase: { type: "string", enum: ["analysis", "development"], description: "The phase being entered." },
            model: { type: "string", description: "The provider/model and optional #variant assigned to this phase in the current Integral agent's Markdown instructions." },
          },
          required: ["phase", "model"],
          additionalProperties: false,
        },
        execute: async (input, context) => {
          if (context.agent !== "integral") throw new Error("set_integral_phase is reserved for the Integral agent")
          const model = parseModel(input.model)
          const response = await ctx.model.list()
          const available = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : Array.isArray(response?.models) ? response.models : []
          const match = available.find((item) => item.providerID === model.providerID && item.id === model.id)
          if (!match) throw new Error(`Model ${model.providerID}/${model.id} is not available in this OpenCode location`)
          const variants = Array.isArray(match.variants) ? match.variants.map((item) => typeof item === "string" ? item : item?.id) : Object.keys(match.variants ?? {})
          if (model.variant && !variants.includes(model.variant)) throw new Error(`Variant #${model.variant} is not available for ${model.providerID}/${model.id}`)
          await ctx.session.switchModel({ sessionID: context.sessionID, model })
          return { content: `Integral phase set to ${input.phase}; selected ${model.providerID}/${model.id}${model.variant ? `#${model.variant}` : ""}.` }
        },
      })
    })
  },
})
