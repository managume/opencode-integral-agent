"""Regression checks for Integral's generic continuity and Git guidance."""

from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
AGENT = (ROOT / "agents/integral.md").read_text(encoding="utf-8")
INIT = (ROOT / "commands/integral-init.md").read_text(encoding="utf-8")
README = (ROOT / "README.md").read_text(encoding="utf-8")


class InstructionRegressionTests(unittest.TestCase):
    def test_agent_requires_continuity_checkpoint_and_evidence(self):
        required = (
            "Do not voluntarily end a turn",
            "task checklist",
            "Resume before replanning",
            "`.opencode/checkpoints/integral-<task-id>.md`",
            "Compilation or a successful build is not sufficient",
            "Never claim execution continues in the background",
            "sole authority for completion",
        )
        for phrase in required:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, AGENT)

    def test_parallel_writers_require_verified_worktrees(self):
        self.assertIn("one separate Git worktree and branch per writer", AGENT)
        self.assertIn("Before any child edits", AGENT)
        self.assertIn("continue the implementation sequentially", AGENT)
        self.assertIn("Integral reviews each delivery", AGENT)
        self.assertIn("un worktree y una rama propios", README)

    def test_setup_captures_project_git_policy_and_ignores_checkpoints(self):
        self.assertIn("never assume the destination branch", INIT)
        self.assertIn("Add `/.opencode/checkpoints/`", INIT)


class DisposableGitRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="integral-git-test-")
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        self.repo.mkdir()
        self.git("init", "-b", "develop")
        self.git("config", "user.name", "Integral Test")
        self.git("config", "user.email", "integral-test@example.invalid")
        (self.repo / "base.txt").write_text("base\n", encoding="utf-8")
        (self.repo / "shared.txt").write_text("common base\n", encoding="utf-8")
        self.git("add", "base.txt", "shared.txt")
        self.git("commit", "-m", "base")

    def git(self, *args, cwd=None, check=True):
        result = subprocess.run(
            ["git", "-C", str(cwd or self.repo), *args],
            text=True,
            capture_output=True,
            check=False,
        )
        if check and result.returncode:
            self.fail(f"git {' '.join(args)} failed:\n{result.stdout}{result.stderr}")
        return result

    def commit_file(self, path, content, message, cwd=None):
        target = (cwd or self.repo) / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        self.git("add", path, cwd=cwd)
        self.git("commit", "-m", message, cwd=cwd)

    def test_worktrees_keep_parallel_changes_isolated_and_integrable(self):
        self.git("branch", "feature/alpha")
        self.git("branch", "feature/beta")
        alpha = Path(self.temp.name) / "alpha"
        beta = Path(self.temp.name) / "beta"
        self.git("worktree", "add", str(alpha), "feature/alpha")
        self.git("worktree", "add", str(beta), "feature/beta")
        self.addCleanup(lambda: self.git("worktree", "remove", str(alpha), check=False))
        self.addCleanup(lambda: self.git("worktree", "remove", str(beta), check=False))

        self.commit_file("alpha.txt", "alpha\n", "alpha work", cwd=alpha)
        self.commit_file("beta.txt", "beta\n", "beta work", cwd=beta)
        self.assertFalse(self.git("status", "--porcelain").stdout)
        self.git("merge", "--no-ff", "--no-edit", "feature/alpha")
        self.git("merge", "--no-ff", "--no-edit", "feature/beta")
        self.assertEqual((self.repo / "alpha.txt").read_text(encoding="utf-8"), "alpha\n")
        self.assertEqual((self.repo / "beta.txt").read_text(encoding="utf-8"), "beta\n")
        self.assertFalse(self.git("status", "--porcelain").stdout)

    def test_integrated_feature_can_receive_new_commit_without_losing_user_edits(self):
        self.git("switch", "-c", "feature/work")
        self.commit_file("feature.txt", "previous feature\n", "previous feature work")
        self.git("switch", "develop")
        self.git("merge", "--no-ff", "--no-edit", "feature/work")

        self.git("switch", "feature/work")
        (self.repo / "feature.txt").write_text("new verified work\n", encoding="utf-8")
        (self.repo / "user-notes.txt").write_text("keep this user edit\n", encoding="utf-8")
        self.git("add", "feature.txt")
        self.git("commit", "-m", "new feature work")
        self.assertIn("user-notes.txt", self.git("status", "--porcelain").stdout)

        self.git("switch", "develop")
        self.git("merge", "--no-ff", "--no-edit", "feature/work")
        self.assertEqual((self.repo / "feature.txt").read_text(encoding="utf-8"), "new verified work\n")
        self.assertEqual((self.repo / "user-notes.txt").read_text(encoding="utf-8"), "keep this user edit\n")
        self.assertIn("user-notes.txt", self.git("status", "--porcelain").stdout)
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "develop")

    def test_conflict_is_reported_with_both_sides_retained(self):
        self.git("switch", "-c", "feature/conflict")
        self.commit_file("shared.txt", "feature side\n", "feature edit")
        self.git("switch", "develop")
        self.commit_file("shared.txt", "develop side\n", "develop edit")

        merge = self.git("merge", "--no-ff", "--no-edit", "feature/conflict", check=False)
        self.assertNotEqual(merge.returncode, 0)
        self.assertIn("UU shared.txt", self.git("status", "--porcelain").stdout)
        content = (self.repo / "shared.txt").read_text(encoding="utf-8")
        self.assertIn("feature side", content)
        self.assertIn("develop side", content)
        self.assertEqual(self.git("branch", "--show-current").stdout.strip(), "develop")


if __name__ == "__main__":
    unittest.main()
