import { Modal, type App } from "obsidian";

export class IndexWipeMigrationModal extends Modal {
  private readonly props: {
    app: App;
    onConfirm: () => void;
    onCancel?: () => void;
  };
  private _confirmed = false;

  constructor(props: {
    app: App;
    onConfirm: () => void;
    onCancel?: () => void;
  }) {
    super(props.app);
    this.props = props;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", {
      text: "Semantic search index must be rebuilt",
    });
    contentEl.createEl("p", {
      text: "The embedding format changed. Your existing index will be deleted and rebuilt automatically. This may take several minutes for large vaults.",
    });
    const btn = contentEl.createEl("button", { text: "Rebuild now" });
    btn.addEventListener("click", () => {
      if (this._confirmed) return;
      this._confirmed = true;
      this.props.onConfirm();
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
    if (!this._confirmed) {
      this.props.onCancel?.();
    }
  }
}
