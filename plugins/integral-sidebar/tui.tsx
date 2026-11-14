import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"

type Section = "models" | "global" | "project"
type ModelAssignment = { task: string; model: string }

const configHome = process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config")

export default Plugin.define({
  id: "integral-sidebar",
  setup(context) {
    const configDir = typeof (context.options as { configDir?: unknown } | undefined)?.configDir === "string"
      ? (context.options as { configDir: string }).configDir
      : path.join(configHome, "opencode")
    const globalLearnPath = path.join(configDir, "LEARN.md")
    const [visible, setVisible] = createSignal(true)
    const [expanded, setExpanded] = createSignal<Record<Section, boolean>>({
      models: true,
      global: true,
      project: true,
    })

    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "integral-sidebar.toggle",
        title: "Mostrar u ocultar el addon del sidebar de Integral",
        group: "Integral · Sidebar",
        palette: true,
        slash: { name: "integral-sidebar" },
        run: () => setVisible((current) => !current),
      }],
    }))

    context.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }: { sessionID?: string }) => (
        <Show when={visible()}>
          <Sidebar
            sessionID={sessionID}
            globalLearnPath={globalLearnPath}
            expanded={expanded}
            onToggle={(section) => setExpanded((current) => ({ ...current, [section]: !current[section] }))}
          />
        </Show>
      ),
    })
  },
})

function Sidebar(props: {
  sessionID?: string
  globalLearnPath: string
  expanded: () => Record<Section, boolean>
  onToggle: (section: Section) => void
}) {
  const context = usePlugin()
  const [revision, setRevision] = createSignal(0)
  const theme = context.theme

  const directory = () => {
    revision()
    const session = props.sessionID ? context.data.session.get(props.sessionID) as any : undefined
    return session?.directory || context.location?.directory || process.cwd()
  }

  const projectLearnPath = () => findUp(directory(), (dir) => {
    const candidate = path.join(dir, ".opencode", "LEARN.md")
    return existsSync(candidate) ? candidate : undefined
  })

  const agentsPath = () => findUp(directory(), (dir) => {
    const candidate = path.join(dir, "AGENTS.md")
    return existsSync(candidate) ? candidate : undefined
  })

  const globalContent = () => {
    revision()
    return readOptional(props.globalLearnPath)
  }

  const projectContent = () => {
    revision()
    const file = projectLearnPath()
    return file ? readOptional(file) : undefined
  }

  const assignments = () => {
    revision()
    const file = agentsPath()
    return file ? parseAssignments(readOptional(file) ?? "") : []
  }

  createEffect(() => {
    const timer = setInterval(() => setRevision((value) => value + 1), 2000)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <box flexDirection="column" gap={1}>
      <Divider />
      <FoldHeading title="Modelos por fase" open={props.expanded().models} onToggle={() => props.onToggle("models")} />
      {props.expanded().models && (
        <box flexDirection="column">
          {assignments().length > 0 ? (
            <For each={assignments()}>{(item) => <ModelRow item={item} />}</For>
          ) : (
            <text fg={theme.text.muted}>No hay asignaciones en AGENTS.md.</text>
          )}
        </box>
      )}

      <FoldHeading title={`LEARN.md del proyecto${countSuffix(projectContent())}`} open={props.expanded().project} onToggle={() => props.onToggle("project")} />
      {props.expanded().project && <MarkdownContent content={projectContent()} missing="Este proyecto todavía no tiene .opencode/LEARN.md." />}

      <FoldHeading title={`LEARN.md global${countSuffix(globalContent())}`} open={props.expanded().global} onToggle={() => props.onToggle("global")} />
      {props.expanded().global && <MarkdownContent content={globalContent()} missing="No se encontró el LEARN.md global." />}
    </box>
  )
}

function Divider() {
  const theme = usePlugin().theme
  return <text fg={theme.text.muted}>────────────────────</text>
}

function FoldHeading(props: { title: string; open: boolean; onToggle: () => void }) {
  const theme = usePlugin().theme
  return (
    <box onMouseDown={(event) => { if (event.button === 0) props.onToggle() }}>
      <text fg={theme.text.base} selectable={false}><b>{props.open ? "▾" : "▸"} {props.title}</b></text>
    </box>
  )
}

function ModelRow(props: { item: ModelAssignment }) {
  const theme = usePlugin().theme
  return (
    <text fg={theme.text.base} wrapMode="word">• {props.item.task}: {props.item.model}</text>
  )
}

function MarkdownContent(props: { content?: string; missing: string }) {
  const theme = usePlugin().theme
  if (!props.content) return <text fg={theme.text.muted} wrapMode="word">{props.missing}</text>
  const entries = compactLearnEntries(props.content)
  return (
    <box flexDirection="column">
      <For each={entries}>{(entry) => (
        <text fg={theme.text.muted} wrapMode="word">• {entry}</text>
      )}</For>
    </box>
  )
}

function compactLearnEntries(content: string): string[] {
  const entries: string[] = []
  let current = ""
  for (const line of content.split(/\r?\n/)) {
    const item = line.match(/^\s*[-*+]\s+(.+)$/)
    if (item) {
      if (current) entries.push(summarizeLearnEntry(current))
      current = item[1].trim()
    } else if (current && line.trim()) {
      current += ` ${line.trim()}`
    }
  }
  if (current) entries.push(summarizeLearnEntry(current))
  return entries.filter(Boolean)
}

function summarizeLearnEntry(entry: string): string {
  let text = entry
    .replace(/\*\*/g, "")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  const status = text.match(/^(Explícita|Provisional|Consolidada)(?:\s*\(([^)]+)\))?:\s*/i)
  if (status) {
    const scope = status[2]?.replace(/\bde\s+\w+$/i, "").trim()
    text = text.slice(status[0].length)
    if (scope) text = `${scope}: ${text}`
  }

  const firstClause = text.split(/[;.!?](?:\s|$)/, 1)[0].trim()
  return truncate(firstClause, 56)
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value
  const cut = value.slice(0, limit - 1)
  const wordBoundary = cut.lastIndexOf(" ")
  return `${cut.slice(0, wordBoundary > limit * 0.65 ? wordBoundary : cut.length).trimEnd()}…`
}

function readOptional(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8")
  } catch {
    return undefined
  }
}

function findUp(start: string, match: (directory: string) => string | undefined): string | undefined {
  let current = path.resolve(start)
  while (true) {
    const result = match(current)
    if (result) return result
    const parent = path.dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function countSuffix(content?: string): string {
  if (!content) return " · 0"
  const entries = content.split(/\r?\n/).filter((line) => /^\s*[-*+]\s+/.test(line)).length
  return ` · ${entries}`
}

function parseAssignments(markdown: string): ModelAssignment[] {
  const result: ModelAssignment[] = []
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.includes("|")) continue
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean)
    if (cells.length < 2 || /^[-: ]+$/.test(cells[0])) continue
    if (/^tarea$/i.test(cells[0])) continue
    const modelMatch = cells[1].match(/(?:[\w.-]+\/){1,}[\w.-]+(?:#[\w.-]+)?/)
    if (!modelMatch) continue
    result.push({
      task: cells[0].replace(/\*\*/g, "").replace(/`/g, ""),
      model: modelMatch[0],
    })
  }
  return result
}
