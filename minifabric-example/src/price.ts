interface RecursivePriceItem {
  totalPrice?: number;
  items?: RecursivePriceItem[];
  type?: string;
  priceType?: string;
}

interface RecursivePriceStructure {
  items?: RecursivePriceItem[];
}

const convertToCents = (price: number) => Math.round(price * 100);

const convertToEuros = (cents: number) => Number((cents / 100).toFixed(2));

const sumRecursiveItemsInCents = (items: RecursivePriceItem[]): number => {
  const total = items.find(
    ({ type, priceType }) => type === 'Price' && priceType === 'Total'
  );
  if (total) {
    return convertToCents(total.totalPrice ?? 0);
  }
  let sumCents = 0;
  for (const item of items) {
    if (item.totalPrice !== undefined) {
      sumCents += convertToCents(item.totalPrice);
    } else if (item.items && item.items.length > 0) {
      sumCents += sumRecursiveItemsInCents(item.items);
    }
  }
  return sumCents;
};

/**
 * The total of the order manager's price structure in euros: the item of the
 * total price of a level, else the sum of its items, summed in cents.
 */
export const calculateTotalSum = (
  structure: RecursivePriceStructure | null | undefined
) => {
  if (!structure?.items || structure.items.length === 0) {
    return 0;
  }
  return convertToEuros(sumRecursiveItemsInCents(structure.items));
};

/**
 * Runs an async task with "latest state wins" semantics: at most one run is
 * in flight, and the triggers that arrive meanwhile are coalesced into one
 * follow-up run. The returned trigger resolves when the task, with its
 * follow-up run, has finished.
 */
export const createCoalescingTaskRunner = (task: () => Promise<void>) => {
  let activeRun: Promise<void> | null = null;
  let rerunRequested = false;

  const runLoop = async () => {
    do {
      rerunRequested = false;
      try {
        await task();
      } catch (error) {
        console.error('Task of coalescing task runner failed:', error);
      }
    } while (rerunRequested);
    activeRun = null;
  };

  return () => {
    if (activeRun) {
      rerunRequested = true;
    } else {
      activeRun = runLoop();
    }
    return activeRun;
  };
};
