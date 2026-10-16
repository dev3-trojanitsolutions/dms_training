# Copyright (c) 2026, Trojan IT Solutions and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase

from dms_training.api import training
from dms_training.registry import is_known_target
from dms_training.setup.install import install_starter_content

REP = "training-rep@example.com"
TRAINER = "training-trainer@example.com"
OUTSIDER = "training-outsider@example.com"
DRIVER = "training-driver@example.com"
ACCOUNTANT = "training-accountant@example.com"
SCENARIO = "Book a Standard Sales Order"


def make_user(email: str, roles: list[str]):
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0}
		).insert(ignore_permissions=True)
	user = frappe.get_doc("User", email)
	user.add_roles(*roles)


class TestTrainingApi(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		install_starter_content()
		for role in ("Sales Rep", "Delivery Partner"):
			if not frappe.db.exists("Role", role):
				frappe.get_doc({"doctype": "Role", "role_name": role}).insert(ignore_permissions=True)
		make_user(REP, ["Sales Rep"])
		make_user(TRAINER, ["Sales Manager"])
		make_user(OUTSIDER, ["Purchase User"])
		make_user(DRIVER, ["Delivery Partner"])
		make_user(ACCOUNTANT, ["Accounts User"])

	def test_registry_matches_placeholders(self):
		self.assertTrue(is_known_target("portal.sales_order", "order.add:PEN-BLU-01"))
		self.assertTrue(is_known_target("portal.sales_order", "dialog.confirm"))
		self.assertTrue(is_known_target("portal.sales_order", "nav.customers"))
		self.assertFalse(is_known_target("portal.sales_order", "order.add"))
		self.assertFalse(is_known_target("portal.sales_home", "order.submit"))

	def test_tracks_follow_roles(self):
		with self.set_user(REP):
			home = training.get_home()
			self.assertFalse(home["is_trainer"])
			self.assertEqual([t.name for t in home["tracks"]], ["Sales Rep"])

		with self.set_user(DRIVER):
			self.assertEqual([t.name for t in training.get_home()["tracks"]], ["Store Keeper & Delivery"])
			with self.assertRaises(frappe.PermissionError):
				training.get_scenario(SCENARIO)

		with self.set_user(ACCOUNTANT):
			home = training.get_home()
			self.assertFalse(home["is_trainer"])
			self.assertEqual([t.name for t in home["tracks"]], ["Sales Manager"])
			self.assertTrue(training.get_scenario("Collect a Payment")["steps"])

		with self.set_user(OUTSIDER):
			self.assertEqual(training.get_home()["tracks"], [])
			with self.assertRaises(frappe.PermissionError):
				training.get_scenario(SCENARIO)

		with self.set_user(TRAINER):
			home = training.get_home()
			self.assertTrue(home["is_trainer"])
			all_tracks = frappe.get_all("Training Track", filters={"is_active": 1}, pluck="name")
			self.assertCountEqual([t.name for t in home["tracks"]], all_tracks)

	def test_get_scenario_returns_steps(self):
		with self.set_user(REP):
			scenario = training.get_scenario(SCENARIO)
		self.assertEqual(scenario["track"], "Sales Rep")
		self.assertTrue(scenario["steps"])
		self.assertEqual(scenario["steps"][0]["screen"], "portal.sales_home")
		self.assertEqual(scenario["next_scenario"], "Save as Pending and Submit Later")

	def test_save_progress_sets_status(self):
		with self.set_user(REP):
			passed = training.save_progress(SCENARIO, "Guided", score=150, hints_used=1)
			failed = training.save_progress(SCENARIO, "Practice", score=40)
			watched = training.save_progress(SCENARIO, "Watch", score=90)
			with self.assertRaises(frappe.ValidationError):
				training.save_progress(SCENARIO, "Speedrun", score=90)

		self.assertEqual((passed["status"], passed["score"]), ("Passed", 100))
		self.assertEqual(failed["status"], "Needs Practice")
		self.assertEqual((watched["status"], watched["score"]), ("Watched", 0))
		self.assertEqual(frappe.db.get_value("Training Progress", passed["name"], "user"), REP)

		with self.set_user(REP):
			best = next(s for t in training.get_home()["tracks"] for s in t.scenarios if s.name == SCENARIO)
		self.assertTrue(best.best["passed"])

	def test_team_progress_is_for_trainers(self):
		with self.set_user(REP):
			with self.assertRaises(frappe.PermissionError):
				training.get_team_progress()
			training.save_progress(SCENARIO, "Guided", score=80)
		with self.set_user(TRAINER):
			rows = training.get_team_progress()["rows"]
		self.assertIn((REP, SCENARIO), [(r["user"], r["scenario"]) for r in rows])

	def test_scenario_rejects_unknown_target(self):
		doc = frappe.get_doc("Training Scenario", SCENARIO)
		doc.steps[0].target = "order.submit"  # not on the dashboard
		with self.assertRaises(frappe.ValidationError):
			doc.validate()
		doc.reload()
		doc.steps[1].target = "customer.open:{customer}"
		doc.steps[1].screen = "portal.sales_customer"
		with self.assertRaises(frappe.ValidationError):
			doc.validate()

	def test_migrate_keeps_desk_edits(self):
		doc = frappe.get_doc("Training Scenario", SCENARIO)
		doc.description = "Edited by a trainer"
		doc.save()
		# Pretend the app shipped a new version of this starter scenario.
		frappe.db.set_value("Training Scenario", SCENARIO, "starter_hash", "older", update_modified=False)
		install_starter_content()
		self.assertEqual(frappe.db.get_value("Training Scenario", SCENARIO, "description"), "Edited by a trainer")

	def test_app_build_names_the_served_script(self):
		# The SPA reloads when this differs from the script it runs.
		build = training.app_build()
		self.assertRegex(build, r"^index-[\w-]+\.js$")
		with self.set_user(REP):
			self.assertEqual(training.get_scenario(SCENARIO)["app_build"], build)
