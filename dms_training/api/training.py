"""API for the /training SPA.

The simulator never touches real Sales Orders, Delivery Notes or invoices. The
only thing written to the database is a Training Progress row per attempt.
"""

import json
import re
from functools import cache
from pathlib import Path

import frappe
from frappe.utils import cint, now_datetime

from dms_training.access import (
	allowed_tracks,
	is_trainer,
	require_login,
	require_scenario_access,
	require_trainer,
)
from dms_training.registry import load_registry

STEP_FIELDS = (
	"title",
	"screen",
	"target",
	"action_type",
	"body",
	"hint",
	"expected_field",
	"expected_value",
	"auto_value",
)


@frappe.whitelist()
def get_home() -> dict:
	"""The user, whether they are a trainer, and the tracks and scenarios they can open."""
	require_login()
	tracks = allowed_tracks()
	return {
		"user": frappe.session.user,
		"full_name": frappe.utils.get_fullname(frappe.session.user),
		"is_trainer": is_trainer(),
		"tracks": _tracks_with_scenarios(tracks),
		"app_build": app_build(),
	}


@frappe.whitelist()
def get_scenario(name: str) -> dict:
	require_scenario_access(name)
	doc = frappe.get_doc("Training Scenario", name)
	return {
		"name": doc.name,
		"title": doc.title,
		"track": doc.track,
		"description": doc.description,
		"difficulty": doc.difficulty,
		"passing_score": doc.passing_score,
		"modes": _modes(doc),
		"seed_data": _parse_seed(doc.seed_data),
		"steps": [{f: step.get(f) or "" for f in STEP_FIELDS} for step in doc.steps],
		"next_scenario": _next_scenario(doc),
		"app_build": app_build(),
	}


@frappe.whitelist(methods=["POST"])
def save_progress(
	scenario: str,
	mode: str,
	score: int = 0,
	hints_used: int = 0,
	mistakes: int = 0,
	time_taken: int = 0,
) -> dict:
	row = require_scenario_access(scenario)
	if mode not in ("Watch", "Guided", "Practice"):
		frappe.throw(frappe._("Unknown training mode: {0}").format(mode))

	score = max(0, min(100, cint(score)))
	if mode == "Watch":
		status, score = "Watched", 0
	else:
		status = "Passed" if score >= cint(row.passing_score) else "Needs Practice"

	progress = frappe.get_doc(
		{
			"doctype": "Training Progress",
			"user": frappe.session.user,
			"scenario": scenario,
			"mode": mode,
			"status": status,
			"score": score,
			"hints_used": max(0, cint(hints_used)),
			"mistakes": max(0, cint(mistakes)),
			"time_taken": max(0, cint(time_taken)),
			"completed_on": now_datetime(),
		}
	)
	# Trainees have no permission on the doctype; this endpoint is the only writer.
	progress.insert(ignore_permissions=True)
	return {"name": progress.name, "status": status, "score": score}


@frappe.whitelist()
def get_team_progress() -> dict:
	"""Best result per user and scenario, for trainers."""
	require_trainer()
	attempts = frappe.get_all(
		"Training Progress",
		fields=["user", "full_name", "scenario", "track", "mode", "status", "score", "completed_on"],
		order_by="completed_on desc",
		limit=5000,
	)
	summary: dict[tuple, dict] = {}
	for attempt in attempts:
		key = (attempt.user, attempt.scenario)
		entry = summary.setdefault(
			key,
			{
				"user": attempt.user,
				"full_name": attempt.full_name or attempt.user,
				"scenario": attempt.scenario,
				"track": attempt.track,
				"attempts": 0,
				"best_score": 0,
				"passed": False,
				"last_status": attempt.status,
				"last_on": attempt.completed_on,
			},
		)
		entry["attempts"] += 1
		entry["best_score"] = max(entry["best_score"], cint(attempt.score))
		entry["passed"] = entry["passed"] or attempt.status == "Passed"

	scenarios = frappe.get_all(
		"Training Scenario",
		filters={"is_active": 1},
		fields=["name", "track"],
		order_by="sequence asc",
	)
	return {"rows": list(summary.values()), "scenarios": scenarios}


@frappe.whitelist()
def get_screen_registry() -> dict:
	"""The screens and targets a step can use. The Training Scenario form shows these as suggestions."""
	require_login()
	return load_registry()


def app_build() -> str:
	"""The entry script the /training page loads, for example `index-BR_zIB7M.js`.

	A browser tab opened before a rebuild still runs the old screens, and can't
	show screens that new scenario steps use. The SPA compares this with its own
	script and reloads when they differ.
	"""
	html = Path(__file__).parent.parent / "www" / "training.html"
	if not html.exists():
		return ""
	return _build_from_html(html.stat().st_mtime, str(html))


@cache
def _build_from_html(_mtime: float, path: str) -> str:
	match = re.search(r"assets/(index-[\w-]+\.js)", Path(path).read_text())
	return match.group(1) if match else ""


def _tracks_with_scenarios(tracks: list[str]) -> list[dict]:
	if not tracks:
		return []
	track_docs = frappe.get_all(
		"Training Track",
		filters={"name": ["in", tracks]},
		fields=["name", "title", "description", "sequence"],
	)
	scenarios = frappe.get_all(
		"Training Scenario",
		filters={"track": ["in", tracks], "is_active": 1},
		fields=[
			"name",
			"title",
			"track",
			"description",
			"difficulty",
			"passing_score",
			"allow_watch",
			"allow_guided",
			"allow_practice",
		],
		order_by="sequence asc, title asc",
	)
	best = _best_results(frappe.session.user)
	by_track: dict[str, list] = {}
	for scenario in scenarios:
		scenario["modes"] = _modes(scenario)
		scenario["best"] = best.get(scenario.name)
		by_track.setdefault(scenario.track, []).append(scenario)

	order = {name: i for i, name in enumerate(tracks)}
	track_docs.sort(key=lambda t: order[t.name])
	for track in track_docs:
		track["scenarios"] = by_track.get(track.name, [])
	return track_docs


def _best_results(user: str) -> dict[str, dict]:
	"""For each scenario: best score, whether it was ever passed, and the last attempt time."""
	attempts = frappe.get_all(
		"Training Progress",
		filters={"user": user},
		fields=["scenario", "status", "score", "completed_on"],
		order_by="completed_on desc",
	)
	best: dict[str, dict] = {}
	for attempt in attempts:
		entry = best.setdefault(
			attempt.scenario,
			{"score": 0, "passed": False, "watched": False, "last_on": attempt.completed_on},
		)
		entry["score"] = max(entry["score"], cint(attempt.score))
		entry["passed"] = entry["passed"] or attempt.status == "Passed"
		entry["watched"] = entry["watched"] or attempt.status == "Watched"
	return best


def _modes(scenario) -> list[str]:
	modes = [
		mode
		for mode, flag in (("Watch", "allow_watch"), ("Guided", "allow_guided"), ("Practice", "allow_practice"))
		if scenario.get(flag)
	]
	return modes or ["Guided"]


def _next_scenario(doc) -> str | None:
	names = frappe.get_all(
		"Training Scenario",
		filters={"track": doc.track, "is_active": 1},
		pluck="name",
		order_by="sequence asc, title asc",
	)
	if doc.name in names:
		i = names.index(doc.name)
		if i + 1 < len(names):
			return names[i + 1]
	return None


def _parse_seed(raw: str | None) -> dict:
	if not raw or not raw.strip():
		return {}
	try:
		seed = json.loads(raw)
	except ValueError:
		return {}
	return seed if isinstance(seed, dict) else {}
