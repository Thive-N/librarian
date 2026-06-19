import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

interface VaultManagerSettings {
	staleDays: number;
}

const DEFAULT_SETTINGS: VaultManagerSettings = {
	staleDays: 7,
};

export default class VaultManagerPlugin extends Plugin {
	settings: VaultManagerSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(
			new VaultManagerSettingTab(this.app, this)
		);

		this.addCommand({
			id: "check-stale-notes",
			name: "Check stale notes",
			callback: () => {
				const staleNotes = this.getStaleNotes();

				if (staleNotes.length === 0) {
					new Notice("No stale notes found");
					return;
				}

				new StaleNotesModal(
					this.app,
					staleNotes,
					this.settings.staleDays
				).open();
			},
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private getStaleNotes(): TFile[] {
		const cutoff =
			Date.now() -
			this.settings.staleDays *
				24 *
				60 *
				60 *
				1000;

		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.stat.mtime < cutoff)
			.sort(
				(a, b) =>
					a.stat.mtime - b.stat.mtime
			);
	}
}

class VaultManagerSettingTab extends PluginSettingTab {
	plugin: VaultManagerPlugin;

	constructor(
		app: App,
		plugin: VaultManagerPlugin
	) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {
			text: "Vault Manager Settings",
		});

		new Setting(containerEl)
			.setName("Stale note threshold")
			.setDesc(
				"Number of days before a note is considered stale"
			)
			.addText((text) =>
				text
					.setPlaceholder("7")
					.setValue(
						this.plugin.settings.staleDays.toString()
					)
					.onChange(async (value) => {
						const days = parseInt(value);

						if (!isNaN(days) && days > 0) {
							this.plugin.settings.staleDays =
								days;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}

class StaleNotesModal extends Modal {
	private files: TFile[];
	private staleDays: number;

	constructor(
		app: App,
		files: TFile[],
		staleDays: number
	) {
		super(app);
		this.files = files;
		this.staleDays = staleDays;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();

		contentEl.createEl("h2", {
			text: `Stale Notes (${this.files.length})`,
		});

		contentEl.createEl("p", {
			text: `Notes not modified in the last ${this.staleDays} days.`,
		});

		this.files.forEach((file) => {
			const row = contentEl.createDiv({
				cls: "vault-manager-stale-note",
			});

			const ageDays = Math.floor(
				(Date.now() - file.stat.mtime) /
					(1000 * 60 * 60 * 24)
			);

			const link = row.createEl("a", {
				text: file.path,
				href: "#",
			});

			link.addEventListener("click", async (e) => {
				e.preventDefault();

				const leaf =
					this.app.workspace.getLeaf();

				await leaf.openFile(file);

				this.close();
			});

			row.createEl("div", {
				text: `Last modified: ${new Date(
					file.stat.mtime
				).toLocaleString()}`,
			});

			row.createEl("div", {
				text: `${ageDays} days old`,
			});

			row.createEl("hr");
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}