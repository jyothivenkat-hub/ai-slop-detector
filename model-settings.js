const MODEL_SETTINGS_KEY = "aiHygiene.modelSettings.v1";

const DEFAULT_MODEL_SETTINGS = {
  source: "local",
  provider: "openai",
  providerModel: "",
  providerApiKey: "",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "",
  ollamaInBrowser: true,
  customEndpoint: "",
  customModel: "",
  customApiKey: ""
};

function loadModelSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(MODEL_SETTINGS_KEY) || "{}");
    return { ...DEFAULT_MODEL_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_MODEL_SETTINGS };
  }
}

function saveModelSettings(settings) {
  localStorage.setItem(MODEL_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("model-settings-change", { detail: settings }));
}

function settingValue(selector) {
  return document.querySelector(selector)?.value.trim() || "";
}

function setSettingValue(selector, value) {
  const field = document.querySelector(selector);
  if (field) {
    field.value = value || "";
  }
}

function settingChecked(selector) {
  return Boolean(document.querySelector(selector)?.checked);
}

function setSettingChecked(selector, value) {
  const field = document.querySelector(selector);
  if (field) {
    field.checked = Boolean(value);
  }
}

function createModelSettingsModal() {
  if (document.querySelector("#modelSettingsBackdrop")) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.id = "modelSettingsBackdrop";
  wrapper.className = "model-settings-backdrop hidden";
  wrapper.innerHTML = `
    <section class="model-settings-modal" role="dialog" aria-modal="true" aria-labelledby="modelSettingsTitle">
      <form class="model-settings-form" id="modelSettingsForm">
        <header class="model-settings-header">
          <div>
            <p class="eyebrow">Generation source</p>
            <h2 id="modelSettingsTitle">Model settings</h2>
            <p class="page-description">Choose how cleaner suggestions should be generated. Local rules work without a key.</p>
          </div>
          <button class="ghost-button model-settings-close" type="button" data-model-settings-close aria-label="Close model settings">x</button>
        </header>

        <div class="model-settings-divider"></div>

        <label class="model-field">
          <span>Suggestion source</span>
          <select id="modelSource">
            <option value="local">Local rules, no key</option>
            <option value="provider">Provider API key</option>
            <option value="ollama">Local model via Ollama</option>
            <option value="custom">Custom OpenAI-compatible endpoint</option>
          </select>
        </label>

        <div class="model-fields" data-model-fields="provider">
          <label class="model-field">
            <span>Provider</span>
            <select id="modelProvider">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
              <option value="groq">Groq</option>
              <option value="mistral">Mistral</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label class="model-field">
            <span>API key</span>
            <input id="providerApiKey" type="password" autocomplete="off" placeholder="Paste your provider API key" />
          </label>
          <label class="model-field">
            <span>Model</span>
            <input id="providerModel" type="text" autocomplete="off" placeholder="Model name" />
          </label>
        </div>

        <div class="model-fields" data-model-fields="ollama">
          <label class="model-field">
            <span>Ollama URL</span>
            <input id="ollamaUrl" type="url" autocomplete="off" placeholder="http://localhost:11434" />
          </label>
          <label class="model-field">
            <span>Local model</span>
            <input id="ollamaModel" type="text" autocomplete="off" placeholder="Local model name" />
          </label>
          <label class="model-field model-field-check">
            <input id="ollamaInBrowser" type="checkbox" />
            <span>Run Ollama from this browser (needed on hosted demos)</span>
          </label>
          <p class="model-field-hint">
            Calls your local Ollama directly from the page, so it works even on the
            hosted demo. Start Ollama allowing this site, for example
            <code>OLLAMA_ORIGINS='*' ollama serve</code>. Turn this off to route the
            call through the local server instead.
          </p>
        </div>

        <div class="model-fields" data-model-fields="custom">
          <label class="model-field">
            <span>Endpoint URL</span>
            <input id="customEndpoint" type="url" autocomplete="off" placeholder="https://api.example.com/v1/chat/completions" />
          </label>
          <label class="model-field">
            <span>API key</span>
            <input id="customApiKey" type="password" autocomplete="off" placeholder="Optional API key" />
          </label>
          <label class="model-field">
            <span>Model</span>
            <input id="customModel" type="text" autocomplete="off" placeholder="Model name" />
          </label>
        </div>

        <p class="model-field-hint">Settings are saved in this browser and sent only when you click Generate with model.</p>

        <div class="model-settings-divider"></div>

        <div class="model-settings-actions">
          <button class="ghost-button" type="button" id="clearModelSettingsButton">Clear saved settings</button>
          <button class="secondary-button" type="button" data-model-settings-close>Cancel</button>
          <button class="primary-button" type="submit" id="saveModelSettingsButton">Save model settings</button>
        </div>
      </form>
    </section>
  `;
  document.body.appendChild(wrapper);
}

function readModelSettingsForm() {
  const current = loadModelSettings();
  return {
    ...current,
    source: settingValue("#modelSource") || "local",
    provider: settingValue("#modelProvider") || "openai",
    providerApiKey: settingValue("#providerApiKey"),
    providerModel: settingValue("#providerModel"),
    ollamaUrl: settingValue("#ollamaUrl") || DEFAULT_MODEL_SETTINGS.ollamaUrl,
    ollamaModel: settingValue("#ollamaModel"),
    ollamaInBrowser: settingChecked("#ollamaInBrowser"),
    customEndpoint: settingValue("#customEndpoint"),
    customApiKey: settingValue("#customApiKey"),
    customModel: settingValue("#customModel")
  };
}

function renderModelSettingsForm() {
  const settings = loadModelSettings();
  setSettingValue("#modelSource", settings.source);
  setSettingValue("#modelProvider", settings.provider);
  setSettingValue("#providerApiKey", settings.providerApiKey);
  setSettingValue("#providerModel", settings.providerModel);
  setSettingValue("#ollamaUrl", settings.ollamaUrl);
  setSettingValue("#ollamaModel", settings.ollamaModel);
  setSettingChecked("#ollamaInBrowser", settings.ollamaInBrowser !== false);
  setSettingValue("#customEndpoint", settings.customEndpoint);
  setSettingValue("#customApiKey", settings.customApiKey);
  setSettingValue("#customModel", settings.customModel);
  updateModelFieldVisibility();
}

function updateModelFieldVisibility() {
  const source = settingValue("#modelSource") || "local";
  document.querySelectorAll("[data-model-fields]").forEach((fields) => {
    fields.classList.toggle("hidden", fields.dataset.modelFields !== source);
  });
}

function openModelSettings() {
  renderModelSettingsForm();
  document.querySelector("#modelSettingsBackdrop")?.classList.remove("hidden");
  document.querySelector("#modelSource")?.focus();
}

function closeModelSettings() {
  document.querySelector("#modelSettingsBackdrop")?.classList.add("hidden");
}

function bindModelSettings() {
  createModelSettingsModal();

  document.querySelectorAll("[data-model-settings-open]").forEach((button) => {
    button.addEventListener("click", openModelSettings);
  });

  document.querySelectorAll("[data-model-settings-close]").forEach((button) => {
    button.addEventListener("click", closeModelSettings);
  });

  document.querySelector("#modelSettingsBackdrop")?.addEventListener("click", (event) => {
    if (event.target?.id === "modelSettingsBackdrop") {
      closeModelSettings();
    }
  });

  document.querySelector("#modelSource")?.addEventListener("change", updateModelFieldVisibility);

  document.querySelector("#clearModelSettingsButton")?.addEventListener("click", () => {
    localStorage.removeItem(MODEL_SETTINGS_KEY);
    renderModelSettingsForm();
    window.dispatchEvent(new CustomEvent("model-settings-change", { detail: loadModelSettings() }));
  });

  document.querySelector("#modelSettingsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveModelSettings(readModelSettingsForm());
    const saveButton = document.querySelector("#saveModelSettingsButton");
    if (saveButton) {
      saveButton.textContent = "Saved";
      window.setTimeout(() => {
        saveButton.textContent = "Save model settings";
        closeModelSettings();
      }, 550);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModelSettings();
    }
  });

  window.aiHygieneModelSettings = {
    get: loadModelSettings,
    open: openModelSettings
  };
}

bindModelSettings();
