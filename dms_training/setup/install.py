"""Load the starter tracks and scenarios.

Missing records are inserted. A starter scenario nobody has edited in Desk is
refreshed when this app ships a new version of it; one a trainer has edited is
left alone, so edits survive `bench migrate`. To retire a starter scenario,
untick Active instead of deleting it, or it comes back on the next migrate.
"""

import hashlib
import json
from pathlib import Path

import frappe

STARTER_PATH = Path(__file__).parent / "starter_content.json"


def after_install():
	install_starter_content()


def after_migrate():
	install_starter_content()


def install_starter_content():
	content = json.loads(STARTER_PATH.read_text())
	for track in content["tracks"]:
		_insert_track(track)
	for scenario in content["scenarios"]:
		_insert_scenario(scenario)
	frappe.db.commit()


def _insert_track(track: dict):
	if frappe.db.exists("Training Track", track["title"]):
		return
	roles = [{"role": role} for role in track["roles"] if frappe.db.exists("Role", role)]
	frappe.get_doc(
		{
			"doctype": "Training Track",
			"title": track["title"],
			"sequence": track.get("sequence", 0),
			"description": track.get("description"),
			"is_active": 1,
			"roles": roles,
		}
	).insert(ignore_permissions=True)


def _insert_scenario(scenario: dict):
	version = hashlib.sha1(json.dumps(scenario, sort_keys=True).encode()).hexdigest()
	if not frappe.db.exists("Training Scenario", scenario["title"]):
		doc = frappe.get_doc({"doctype": "Training Scenario", **_scenario_fields(scenario)})
		doc.insert(ignore_permissions=True)
		_mark_synced(doc, version)
		return

	doc = frappe.get_doc("Training Scenario", scenario["title"])
	if doc.starter_hash == version or _edited_in_desk(doc):
		return
	doc.update(_scenario_fields(scenario))
	doc.set("steps", scenario["steps"])
	doc.save(ignore_permissions=True)
	_mark_synced(doc, version)


def _edited_in_desk(doc) -> bool:
	"""True when someone saved the scenario after the installer last wrote it."""
	synced = doc.starter_synced_on or doc.creation
	return frappe.utils.get_datetime(doc.modified) > frappe.utils.get_datetime(synced)


def _mark_synced(doc, version: str):
	frappe.db.set_value(
		"Training Scenario",
		doc.name,
		{"starter_hash": version, "starter_synced_on": doc.modified},
		update_modified=False,
	)


def _scenario_fields(scenario: dict) -> dict:
	seed = scenario.get("seed_data")
	return {
		"title": scenario["title"],
		"track": scenario["track"],
		"sequence": scenario.get("sequence", 0),
		"difficulty": scenario.get("difficulty", "Beginner"),
		"description": scenario.get("description"),
		"passing_score": scenario.get("passing_score", 70),
		"is_active": 1,
		"allow_watch": 1,
		"allow_guided": 1,
		"allow_practice": 1,
		"seed_data": json.dumps(seed, indent=1) if seed else None,
		"steps": scenario["steps"],
	}
