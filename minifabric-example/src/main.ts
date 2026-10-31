import RoomleEmbeddingApi from '@roomle/embedding-lib';
import {
  createHiLibraryCallbacks,
  setupHi,
  startPlanningAssistant,
} from '@roomle/embedding-lib/hi';
import { EMBEDDING_ID, requestPrice } from '../../shared/src/hi-planner.ts';
import {
  fetchAiKitchenLayout,
  loadLayout,
  removeExternalObjectGroups,
  selectLayoutFile,
} from './layout.ts';
import {
  PLANNING_ASSISTANT_CONFIG,
  orderManagerHeaders,
  plannerOptions,
} from './planner.ts';
import { calculateTotalSum, createCoalescingTaskRunner } from './price.ts';
import {
  applyQueryParams,
  isUserRight,
  loadSettings,
  saveSettings,
  type DemoSettings,
} from './settings.ts';

type Planner = Awaited<ReturnType<typeof RoomleEmbeddingApi.createPlanner>>;

const panel = document.querySelector<HTMLElement>('#settings-panel')!;
const panelToggle = document.querySelector<HTMLButtonElement>(
  '#settings-panel-toggle'
)!;
const form = document.querySelector<HTMLFormElement>('#settings')!;
const button = (id: string) =>
  document.querySelector<HTMLButtonElement>(`#${id}`)!;

const setupSettingsPanel = (settings: DemoSettings) => {
  panelToggle.addEventListener('click', () => {
    const expanded = panel.classList.toggle('is-expanded');
    panelToggle.setAttribute('aria-expanded', String(expanded));
  });
  for (const [name, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(name);
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement
    ) {
      field.value = value;
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const value = (name: string) => String(fields.get(name) ?? '');
    const userRight = value('userRight');
    saveSettings(localStorage, {
      locale: value('locale'),
      apiKey: value('apiKey'),
      libraryId: value('libraryId'),
      subscriptionId: value('subscriptionId'),
      endpointUrl: value('endpointUrl'),
      userRight: isUserRight(userRight) ? userRight : 'Simple',
    });
    location.reload();
  });
};

const whileDisabled = async (
  target: HTMLButtonElement,
  task: () => Promise<unknown>
) => {
  target.disabled = true;
  try {
    await task();
  } finally {
    target.disabled = false;
  }
};

const downloadJson = (data: unknown, fileName: string) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const showPrice = async (planner: Planner) => {
  const priceData = await planner.extended.fetchPrice();
  planner.ui.setPrice('€', calculateTotalSum(priceData?.orderData));
};

const placeOrder = (planner: Planner) => planner.extended.placeOrder(true);

const startExample = async () => {
  const settings = applyQueryParams(
    loadSettings(localStorage),
    location.search
  );
  setupSettingsPanel(settings);
  saveSettings(localStorage, settings);

  const options = plannerOptions(settings, location.search);
  const signal = new AbortController().signal;
  let planner: Planner | undefined;
  const updatePrice = createCoalescingTaskRunner(async () => {
    if (planner) {
      await showPrice(planner);
    }
  });

  await setupHi(options.hi, {
    ...createHiLibraryCallbacks(options.hi),
    onPosGroupsCompletelyLoaded: () => {
      void updatePrice();
    },
    onPriceCalc: () => updatePrice(),
    onLogMessage: (area: string, message: string) =>
      console.info(`${area}: ${message}`),
    onPlaceOrder: async (orderData: unknown) =>
      downloadJson(orderData, 'orderData.json'),
    onFetchPrice: (orderData: unknown) =>
      requestPrice(
        options.hi,
        orderData,
        orderManagerHeaders(options.hi.libraryId)
      ),
  });

  const instance = await RoomleEmbeddingApi.createPlanner(
    EMBEDDING_ID,
    document.querySelector<HTMLElement>('#container')!,
    options
  );
  planner = instance;
  // catch up on the price calculations triggered while the planner was loading
  void updatePrice();

  instance.extended.callbacks.onCompletelyLoaded = () => updatePrice();
  instance.ui.callbacks.onPlanElementAdded = () => updatePrice();
  instance.ui.callbacks.onPlanElementChanged = () => updatePrice();
  instance.ui.callbacks.onPlanElementRemoved = () => updatePrice();
  instance.ui.callbacks.onRequestPlan = async () => {
    void placeOrder(instance);
  };
  (window as unknown as { instance: Planner }).instance = instance;

  await instance.ui.loadObject(options.id);

  void startPlanningAssistant(instance, PLANNING_ASSISTANT_CONFIG, signal);

  const sendToOm = button('send-to-om');
  sendToOm.onclick = () => whileDisabled(sendToOm, () => placeOrder(instance));
  const calcPrice = button('calc-price');
  calcPrice.onclick = () => whileDisabled(calcPrice, updatePrice);
  const loadLayoutButton = button('load-layout');
  loadLayoutButton.onclick = async () => {
    const layout = await selectLayoutFile();
    if (layout) {
      await whileDisabled(loadLayoutButton, () => loadLayout(instance, layout));
    }
  };
  const generateWithAi = button('generate-with-ai');
  generateWithAi.onclick = () =>
    whileDisabled(generateWithAi, async () => {
      try {
        const [layout] = await Promise.all([
          fetchAiKitchenLayout(signal),
          removeExternalObjectGroups(instance),
        ]);
        await loadLayout(instance, layout);
      } catch (error) {
        console.error(error);
      }
    });
};

void startExample();
