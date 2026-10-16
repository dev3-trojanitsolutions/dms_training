// Copyright (c) 2026, Trojan IT Solutions and contributors
// For license information, please see license.txt

// Suggest the screens and targets the simulator knows, so trainers pick from a
// list instead of typing ids. The server validates them again on save.

let registry = null;

async function load_registry() {
	if (!registry) {
		const r = await frappe.call("dms_training.api.training.get_screen_registry");
		registry = r.message;
	}
	return registry;
}

function screen_options() {
	return Object.entries(registry.screens).map(([value, spec]) => ({
		value,
		label: `${spec.label} (${value})`,
	}));
}

function target_options(screen) {
	const screens = screen && registry.screens[screen] ? [screen] : Object.keys(registry.screens);
	const targets = {};
	for (const key of screens) {
		const spec = registry.screens[key];
		for (const group of spec.include || []) Object.assign(targets, registry.groups[group]);
		Object.assign(targets, spec.targets);
	}
	return Object.entries(targets).map(([value, label]) => ({ value, label: `${value}: ${label}` }));
}

function narrow_targets(frm, row) {
	const field = frm.cur_grid?.grid_form?.fields_dict?.target;
	if (registry && field?.set_data) field.set_data(target_options(row?.screen));
}

frappe.ui.form.on("Training Scenario", {
	async refresh(frm) {
		await load_registry();
		const grid = frm.fields_dict.steps.grid;
		grid.update_docfield_property("screen", "options", screen_options());
		grid.update_docfield_property("target", "options", target_options());

		if (!frm.is_new()) {
			for (const mode of ["Watch", "Guided", "Practice"]) {
				if (!frm.doc[`allow_${mode.toLowerCase()}`]) continue;
				frm.add_custom_button(
					__(mode),
					() => window.open(`/training/s/${encodeURIComponent(frm.doc.name)}?mode=${mode.toLowerCase()}`),
					__("Open in Simulator")
				);
			}
		}
	},

	steps_on_form_rendered(frm) {
		const row = frm.cur_grid?.doc;
		narrow_targets(frm, row);
	},
});

frappe.ui.form.on("Training Step", {
	screen(frm, cdt, cdn) {
		narrow_targets(frm, locals[cdt][cdn]);
	},
});
