# Copyright (c) 2026, Trojan IT Solutions and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document

from dms_training.registry import is_known_screen, is_known_target


class TrainingScenario(Document):
	def validate(self):
		self._validate_modes()
		self._validate_steps()
		self._validate_seed_data()

	def _validate_modes(self):
		if not (self.allow_watch or self.allow_guided or self.allow_practice):
			frappe.throw(_("Allow at least one mode: Watch, Guided or Practice."))

	def _validate_steps(self):
		for step in self.steps:
			if not is_known_screen(step.screen):
				frappe.throw(_("Row {0}: unknown screen {1}.").format(step.idx, frappe.bold(step.screen)))
			if step.action_type != "Observe" and not step.target:
				frappe.throw(_("Row {0}: a {1} step needs a target.").format(step.idx, step.action_type))
			if "{" in (step.target or ""):
				frappe.throw(
					_("Row {0}: replace the placeholder in {1} with a real value.").format(
						step.idx, frappe.bold(step.target)
					)
				)
			if step.target and not is_known_target(step.screen, step.target):
				frappe.throw(
					_("Row {0}: {1} is not a target on screen {2}.").format(
						step.idx, frappe.bold(step.target), step.screen
					)
				)

	def _validate_seed_data(self):
		if not (self.seed_data or "").strip():
			return
		try:
			seed = json.loads(self.seed_data)
		except ValueError as e:
			frappe.throw(_("Sample Data is not valid JSON: {0}").format(e))
		if not isinstance(seed, dict):
			frappe.throw(_("Sample Data must be a JSON object."))
