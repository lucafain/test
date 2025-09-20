const ORDER_STORAGE_KEY = 'frigorifico_orders';
const INVENTORY_STORAGE_KEY = 'frigorifico_inventory';
const ORDER_LOCK_KEY = 'frigorifico_order_lock';

const CRATE_OPTIONS = [
  { id: 'X', label: 'Cajón X' },
  { id: '6', label: 'Cajón de 6 cabezas' },
  { id: '7', label: 'Cajón de 7 cabezas' },
  { id: '8', label: 'Cajón de 8 cabezas' },
  { id: '9', label: 'Cajón de 9 cabezas' },
  { id: '10', label: 'Cajón de 10 cabezas' }
];

document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  activatePage();
  setupLinkTransitions();

  const orderSection = document.getElementById('orderSection');
  const orderForm = document.getElementById('orderForm');
  const confirmationSection = document.getElementById('confirmation');
  const confirmationDetails = document.getElementById('confirmationDetails');
  const reviewSection = document.getElementById('reviewSection');
  const reviewDetails = document.getElementById('reviewDetails');
  const reviewConfirmButton = document.getElementById('reviewConfirm');
  const reviewBackButton = document.getElementById('reviewBack');
  const crateOptionsContainer = document.getElementById('crateOptions');
  const orderMessage = document.getElementById('orderMessage');
  const submitButton = orderForm.querySelector('button[type="submit"]');
  const globalAlert = document.getElementById('globalAlert');
  const processingSection = document.getElementById('processingSection');
  const processingBar = document.getElementById('processingBar');
  const processingLabel = document.getElementById('processingPercent');

  let inventory = normalizeInventory(loadInventory());
  let pendingOrderContext = null;
  const orderDraft = createEmptyOrderDraft();

  populateOrderDraftFromForm(orderForm, orderDraft);

  resetOrderLockIfNeeded();

  if (isOrderLocked()) {
    showLockedConfirmation(orderSection, confirmationSection, confirmationDetails, inventory);
    return;
  }

  renderCrateOptions(
    crateOptionsContainer,
    inventory,
    submitButton,
    orderMessage,
    globalAlert,
    { selectedCrateId: orderDraft.crateId, orderDraft }
  );
  activateCard(orderSection);

  orderForm.addEventListener('reset', () => {
    resetOrderDraft(orderDraft);
  });

  const handleOrderFormInteraction = (event) => {
    hideMessage(orderMessage);
    hideAlert(globalAlert);
    pendingOrderContext = null;

    if (event && event.target) {
      updateOrderDraftField(orderDraft, event.target);
    }
  };

  orderForm.addEventListener('input', handleOrderFormInteraction);
  orderForm.addEventListener('change', handleOrderFormInteraction);

  if (reviewBackButton) {
    reviewBackButton.addEventListener('click', () => {
      hideAlert(globalAlert);
      reviewSection.classList.add('card--hidden');
      confirmationSection.classList.add('card--hidden');
      orderSection.classList.remove('card--hidden');
      activateCard(orderSection);

      if (pendingOrderContext) {
        restoreOrderFormValues(orderForm, pendingOrderContext.order, orderDraft);
        pendingOrderContext = null;
      }

      const firstInvalid = orderForm.querySelector(':invalid');
      if (firstInvalid) {
        firstInvalid.focus();
      }
    });
  }

  if (reviewConfirmButton) {
    reviewConfirmButton.addEventListener('click', () => {
      if (!pendingOrderContext) {
        return;
      }

      const { order, updatedInventory, crateData } = pendingOrderContext;
      const orderToPersist = {
        ...order,
        timestamp: Date.now()
      };

      persistInventory(updatedInventory);
      inventory = normalizeInventory(updatedInventory);
      persistOrder(orderToPersist);
      lockOrdering();

      const refreshedCrateData = inventory.find((item) => item.id === order.crateId) ?? crateData ?? null;

      pendingOrderContext = null;

      reviewSection.classList.add('card--hidden');
      orderSection.classList.add('card--hidden');
      confirmationSection.classList.add('card--hidden');

      startProcessingTransition(processingSection, processingBar, () => {
        renderConfirmation(confirmationDetails, orderToPersist, refreshedCrateData);
        confirmationSection.classList.remove('card--hidden');
        activateCard(confirmationSection);

        orderForm.reset();
        resetOrderDraft(orderDraft);
        hideMessage(orderMessage);
        hideAlert(globalAlert);
        renderCrateOptions(
          crateOptionsContainer,
          inventory,
          submitButton,
          orderMessage,
          globalAlert,
          {
            preserveAlerts: true,
            preserveMessage: true,
            selectedCrateId: orderDraft.crateId,
            orderDraft
          }
        );
      }, processingLabel);
    });
  }

  orderForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (isOrderLocked()) {
      showLockedConfirmation(orderSection, confirmationSection, confirmationDetails, inventory);
      return;
    }

    const formData = new FormData(orderForm);

    const storeName = (formData.get('storeName') || '').toString().trim();
    const storeAddress = (formData.get('storeAddress') || '').toString().trim();
    const crateId = (formData.get('crateSize') || '').toString();
    const quantityRaw = formData.get('crateQuantity');
    const quantity = Number.parseInt(
      typeof quantityRaw === 'string' ? quantityRaw : `${quantityRaw ?? ''}`,
      10
    );

    hideMessage(orderMessage);
    hideAlert(globalAlert);

    if (!storeName) {
      displayMessage(orderMessage, 'Ingrese el nombre de su local para continuar.');
      orderForm.storeName.focus();
      return;
    }

    if (!storeAddress) {
      displayMessage(orderMessage, 'Ingrese la dirección completa del local.');
      orderForm.storeAddress.focus();
      return;
    }

    if (!crateId) {
      displayMessage(orderMessage, 'Seleccione un cajón disponible.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      displayMessage(orderMessage, 'La cantidad debe ser un número válido mayor que cero.');
      orderForm.crateQuantity.focus();
      return;
    }

    inventory = normalizeInventory(loadInventory());

    const crateData = inventory.find((item) => item.id === crateId);
    const availableStock = Number.isFinite(crateData?.stock)
      ? Number.parseInt(crateData.stock, 10)
      : 0;

    if (!crateData || availableStock <= 0) {
      displayMessage(orderMessage, 'No hay stock disponible para el cajón seleccionado.');
      renderCrateOptions(
        crateOptionsContainer,
        inventory,
        submitButton,
        orderMessage,
        globalAlert,
        {
          preserveAlerts: true,
          preserveMessage: true,
          selectedCrateId: orderDraft.crateId,
          orderDraft
        }
      );
      return;
    }

    if (quantity > availableStock) {
      const stockMessage = availableStock === 1
        ? 'No es posible completar el pedido. El máximo disponible es 1 cajón.'
        : `No es posible completar el pedido. El máximo disponible es ${availableStock} cajones.`;
      const alertMessage = availableStock === 0
        ? 'Se está excediendo del stock disponible. No quedan cajones en inventario.'
        : `Se está excediendo del stock disponible. El stock restante es ${availableStock} ${availableStock === 1 ? 'cajón' : 'cajones'}.`;
      displayMessage(orderMessage, stockMessage);
      showAlert(globalAlert, alertMessage);
      renderCrateOptions(
        crateOptionsContainer,
        inventory,
        submitButton,
        orderMessage,
        globalAlert,
        {
          preserveAlerts: true,
          preserveMessage: true,
          selectedCrateId: orderDraft.crateId,
          orderDraft
        }
      );
      return;
    }

    const remainingStock = availableStock - quantity;
    const updatedInventory = inventory.map((item) =>
      item.id === crateId
        ? { ...item, stock: remainingStock }
        : item
    );

    const crateLabel = crateData.label;
    const unitPrice = Number.isFinite(crateData.price) ? Number(crateData.price) : 0;
    const totalPrice = unitPrice > 0 ? unitPrice * quantity : 0;

    const order = {
      storeName,
      storeAddress,
      crateSize: crateLabel,
      crateId,
      quantity,
      unitPrice,
      totalPrice
    };

    updateOrderDraftFromOrder(orderDraft, order);

    pendingOrderContext = {
      order,
      updatedInventory,
      crateData
    };

    renderOrderDetails(reviewDetails, order, crateData);

    orderSection.classList.add('card--hidden');
    confirmationSection.classList.add('card--hidden');
    reviewSection.classList.remove('card--hidden');
    activateCard(reviewSection);
  });
});

function persistOrder(order) {
  const stored = localStorage.getItem(ORDER_STORAGE_KEY);
  let orders = [];

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        orders = parsed;
      }
    } catch (error) {
      console.error('Error al leer pedidos guardados', error);
    }
  }

  orders.push(order);
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
}

function loadInventory() {
  const stored = localStorage.getItem(INVENTORY_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error('Error al leer el inventario', error);
    }
  }

  return [];
}

function normalizeInventory(inventory) {
  const source = Array.isArray(inventory) ? inventory : [];
  return CRATE_OPTIONS.map((option) => {
    const match = source.find((item) => item.id === option.id) ?? {};
    const stockValue = Number.parseInt(match.stock ?? 0, 10);
    const priceValue = Number.parseFloat(match.price ?? 0);
    return {
      id: option.id,
      label: option.label,
      stock: Number.isFinite(stockValue) && stockValue > 0 ? stockValue : 0,
      price: Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : 0
    };
  });
}

function renderCrateOptions(
  container,
  inventory,
  submitButton,
  messageContainer,
  alertContainer,
  options
) {
  if (!container) {
    return;
  }

  const normalizedOptions = options && typeof options === 'object' ? options : {};
  const preserveAlerts = !!normalizedOptions.preserveAlerts;
  const preserveMessage = !!normalizedOptions.preserveMessage;
  const selectedCrateId = typeof normalizedOptions.selectedCrateId === 'string'
    ? normalizedOptions.selectedCrateId
    : '';
  const draftReference = normalizedOptions.orderDraft && typeof normalizedOptions.orderDraft === 'object'
    ? normalizedOptions.orderDraft
    : null;

  let availableCount = 0;

  container.innerHTML = CRATE_OPTIONS.map((option) => {
    const data = inventory.find((item) => item.id === option.id) ?? option;
    const stock = Number.isFinite(data.stock) ? Number.parseInt(data.stock, 10) : 0;
    const price = Number.isFinite(data.price) ? Number(data.price) : 0;
    const available = stock > 0;
    if (available) {
      availableCount += 1;
    }

    const metaParts = [];
    if (price > 0) {
      metaParts.push(`Precio: ${formatCurrency(price)}`);
    }
    if (!available) {
      metaParts.push('Producto sin stock por el momento');
    }
    const metaText = metaParts.join(' · ');

    return `
      <label class="radio${available ? '' : ' radio--disabled'}">
        <input type="radio" name="crateSize" value="${option.id}" data-label="${option.label}" ${available ? '' : 'disabled'}>
        <span class="radio__title">${option.label}</span>
        <span class="radio__meta">${metaText}</span>
      </label>
    `;
  }).join('');

  if (selectedCrateId) {
    const selectedInput = container.querySelector(`input[name="crateSize"][value="${selectedCrateId}"]`);
    if (selectedInput && !selectedInput.disabled) {
      selectedInput.checked = true;
      if (draftReference) {
        draftReference.crateId = selectedCrateId;
      }
    } else if (draftReference) {
      draftReference.crateId = '';
    }
  }

  const firstEnabled = container.querySelector('input[name="crateSize"]:not([disabled])');
  if (firstEnabled) {
    firstEnabled.required = true;
  }

  if (submitButton) {
    submitButton.disabled = availableCount === 0;
  }

  if (!selectedCrateId && draftReference) {
    const checkedInput = container.querySelector('input[name="crateSize"]:checked');
    draftReference.crateId = checkedInput && !checkedInput.disabled
      ? checkedInput.value
      : '';
  }

  if (availableCount === 0) {
    displayMessage(
      messageContainer,
      'En este momento no hay stock disponible para realizar pedidos.'
    );
    showAlert(
      alertContainer,
      'Momentáneamente no hay stock disponible para ningún cajón. '
        + 'Por favor, vuelva a intentar más tarde.'
    );
  } else {
    if (!preserveMessage) {
      hideMessage(messageContainer);
    }
    if (!preserveAlerts) {
      hideAlert(alertContainer);
    }
  }
}

function persistInventory(inventory) {
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
}

function formatCurrency(value) {
  return Number(value).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  });
}

function displayMessage(container, message) {
  if (!container) {
    return;
  }

  container.textContent = message;
  container.hidden = !message;
}

function hideMessage(container) {
  if (!container) {
    return;
  }

  container.textContent = '';
  container.hidden = true;
}

function showAlert(container, message) {
  if (!container) {
    return;
  }

  container.textContent = message;
  container.hidden = !message;
}

function hideAlert(container) {
  if (!container) {
    return;
  }

  container.textContent = '';
  container.hidden = true;
}

function isOrderLocked() {
  if (localStorage.getItem(ORDER_LOCK_KEY)) {
    localStorage.removeItem(ORDER_LOCK_KEY);
  }
  return false;
}

function lockOrdering() {
  localStorage.removeItem(ORDER_LOCK_KEY);
}

function resetOrderLockIfNeeded() {
  if (localStorage.getItem(ORDER_LOCK_KEY)) {
    localStorage.removeItem(ORDER_LOCK_KEY);
  }
}

function getLastOrder() {
  const stored = localStorage.getItem(ORDER_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed[parsed.length - 1];
      }
    } catch (error) {
      console.error('Error al recuperar el último pedido', error);
    }
  }
  return null;
}

function createEmptyOrderDraft() {
  return {
    storeName: '',
    storeAddress: '',
    quantity: '',
    crateId: ''
  };
}

function resetOrderDraft(draft) {
  if (!draft) {
    return;
  }

  draft.storeName = '';
  draft.storeAddress = '';
  draft.quantity = '';
  draft.crateId = '';
}

function populateOrderDraftFromForm(form, draft) {
  if (!form || !draft) {
    return;
  }

  draft.storeName = form?.storeName?.value ?? '';
  draft.storeAddress = form?.storeAddress?.value ?? '';
  draft.quantity = form?.crateQuantity?.value ?? '';

  const checkedCrate = form.querySelector?.('input[name="crateSize"]:checked');
  draft.crateId = checkedCrate && !checkedCrate.disabled
    ? checkedCrate.value ?? ''
    : '';
}

function updateOrderDraftField(draft, element) {
  if (!draft || !element) {
    return;
  }

  const name = typeof element.name === 'string' && element.name
    ? element.name
    : typeof element.getAttribute === 'function'
      ? element.getAttribute('name') ?? ''
      : '';

  if (!name) {
    return;
  }

  const rawValue = typeof element.value === 'string'
    ? element.value
    : element.value == null
      ? ''
      : String(element.value);

  switch (name) {
    case 'storeName':
      draft.storeName = rawValue ?? '';
      break;
    case 'storeAddress':
      draft.storeAddress = rawValue ?? '';
      break;
    case 'crateQuantity':
      draft.quantity = rawValue ?? '';
      break;
    case 'crateSize':
      if (typeof element.checked === 'boolean' && element.checked) {
        draft.crateId = typeof element.value === 'string' && element.value
          ? element.value
          : rawValue ?? '';
      }
      break;
    default:
      break;
  }
}

function updateOrderDraftFromOrder(draft, order) {
  if (!draft || !order) {
    return;
  }

  draft.storeName = order.storeName ?? '';
  draft.storeAddress = order.storeAddress ?? '';

  if (Number.isFinite(order.quantity)) {
    draft.quantity = String(order.quantity);
  } else if (typeof order.quantity === 'string') {
    draft.quantity = order.quantity;
  } else {
    draft.quantity = '';
  }

  draft.crateId = order.crateId ?? '';
}

function renderOrderDetails(container, order, crateData) {
  if (!container || !order) {
    return;
  }

  const { details } = buildOrderDetails(order, crateData);
  container.innerHTML = details.map((detail) => `<p>${detail}</p>`).join('');
}

function restoreOrderFormValues(form, order, draft) {
  if (!form || !order) {
    return;
  }

  if (form.storeName) {
    const value = order.storeName ?? '';
    form.storeName.value = value;
    if (draft) {
      draft.storeName = value;
    }
  }

  if (form.storeAddress) {
    const value = order.storeAddress ?? '';
    form.storeAddress.value = value;
    if (draft) {
      draft.storeAddress = value;
    }
  }

  if (form.crateQuantity) {
    const quantityValue = Number.isFinite(order.quantity)
      ? String(order.quantity)
      : '';
    form.crateQuantity.value = quantityValue;
    if (draft) {
      draft.quantity = quantityValue;
    }
  }

  let crateIdValue = '';
  if (order.crateId) {
    const crateInput = form.querySelector(`input[name="crateSize"][value="${order.crateId}"]`);
    if (crateInput && !crateInput.disabled) {
      crateInput.checked = true;
      crateIdValue = order.crateId;
    }
  }

  if (draft) {
    draft.crateId = crateIdValue;
  }
}

function buildOrderDetails(order, crateData) {
  const crateLabel = crateData?.label ?? order.crateSize;

  const details = [
    `<strong>Comercio:</strong> ${order.storeName}`,
    `<strong>Dirección:</strong> ${order.storeAddress}`,
    `<strong>Cantidad:</strong> ${order.quantity} ${order.quantity === 1 ? 'cajón' : 'cajones'}`,
    `<strong>Cajón solicitado:</strong> ${crateLabel}`
  ];

  const normalizedUnitPrice = Number.isFinite(order.unitPrice)
    ? Number(order.unitPrice)
    : Number.isFinite(crateData?.price)
      ? Number(crateData.price)
      : 0;

  const normalizedTotalPrice = Number.isFinite(order.totalPrice)
    ? Number(order.totalPrice)
    : normalizedUnitPrice > 0
      ? normalizedUnitPrice * order.quantity
      : 0;

  if (normalizedUnitPrice > 0) {
    details.push(`<strong>Precio unitario:</strong> ${formatCurrency(normalizedUnitPrice)}`);
  }

  if (normalizedTotalPrice > 0) {
    details.push(`<strong>Total estimado:</strong> ${formatCurrency(normalizedTotalPrice)}`);
  }

  return {
    details,
    crateLabel,
    unitPrice: normalizedUnitPrice,
    totalPrice: normalizedTotalPrice
  };
}

function renderConfirmation(container, order, crateData) {
  if (!container || !order) {
    return;
  }

  const { details, crateLabel, totalPrice } = buildOrderDetails(order, crateData);
  const pluralized = order.quantity === 1 ? 'cajón' : 'cajones';

  const summaryFragments = [
    'Registramos tu pedido con éxito.',
    `Elegiste ${order.quantity} ${pluralized} del ${crateLabel}.`
  ];

  if (Number.isFinite(totalPrice) && totalPrice > 0) {
    summaryFragments.push(`El total estimado es ${formatCurrency(totalPrice)}.`);
  }

  container.innerHTML = `
    <p class="confirmation__message">${summaryFragments.join(' ')}</p>
    <ul class="confirmation__list">
      ${details.map((detail) => `<li>${detail}</li>`).join('')}
    </ul>
  `;
}

function showLockedConfirmation(orderSection, confirmationSection, confirmationDetails, inventory) {
  if (orderSection) {
    orderSection.classList.add('card--hidden');
  }
  if (confirmationSection) {
    confirmationSection.classList.remove('card--hidden');
  }

  const lastOrder = getLastOrder();
  if (lastOrder) {
    const crateData = inventory.find((item) => item.id === lastOrder.crateId) ?? null;
    renderConfirmation(confirmationDetails, lastOrder, crateData);
  } else if (confirmationDetails) {
    confirmationDetails.innerHTML = '<p>No hay detalles para mostrar en este momento.</p>';
  }

  activateCard(confirmationSection);
}

function calculateNextMondayTimestamp(referenceTimestamp) {
  const timestampNumber = Number(referenceTimestamp);

  if (!Number.isFinite(timestampNumber)) {
    return null;
  }

  const referenceDate = new Date(timestampNumber);

  if (Number.isNaN(referenceDate.getTime())) {
    return null;
  }

  const weekStart = new Date(referenceDate);
  weekStart.setHours(0, 0, 0, 0);

  const dayOfWeek = weekStart.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);

  const nextMonday = new Date(weekStart);
  nextMonday.setDate(weekStart.getDate() + 7);

  return nextMonday.getTime();
}

function activatePage() {
  if (document.body && document.body.classList.contains('page--transition')) {
    requestAnimationFrame(() => {
      document.body.classList.add('page--ready');
      document.body.classList.remove('page--exit');
    });
  }
}

function setupLinkTransitions() {
  const links = document.querySelectorAll('a[data-transition]');
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.target === '_blank') {
        return;
      }

      event.preventDefault();
      triggerPageExit(() => {
        window.location.href = href;
      });
    });
  });
}

function triggerPageExit(callback) {
  if (!document.body) {
    callback();
    return;
  }

  document.body.classList.add('page--exit');

  if (shouldReduceMotion()) {
    callback();
    return;
  }

  setTimeout(callback, 350);
}

function activateCard(cardElement) {
  if (!cardElement) {
    return;
  }

  cardElement.classList.remove('card--active');
  void cardElement.offsetWidth;
  cardElement.classList.add('card--active');

  if (shouldReduceMotion()) {
    setTimeout(() => {
      cardElement.classList.remove('card--active');
    }, 0);
  } else {
    setTimeout(() => {
      cardElement.classList.remove('card--active');
    }, 500);
  }
}

function startProcessingTransition(section, bar, callback, label) {
  if (!section) {
    callback();
    return;
  }

  section.classList.remove('card--hidden');
  activateCard(section);

  if (bar) {
    resetProgressBar(bar);
  }

  if (label) {
    resetProgressLabel(label);
  }

  const duration = shouldReduceMotion() ? 0 : 4000;

  if (bar) {
    animateProgressBar(bar, duration);
  }

  if (label) {
    animateProgressLabel(label, duration);
  }

  if (duration === 0) {
    section.classList.add('card--hidden');
    if (bar) {
      resetProgressBar(bar);
    }
    if (label) {
      completeProgressLabel(label);
    }
    callback();
    return;
  }

  setTimeout(() => {
    section.classList.add('card--hidden');
    if (bar) {
      resetProgressBar(bar);
    }
    if (label) {
      completeProgressLabel(label);
    }
    callback();
  }, duration);
}

function animateProgressBar(bar, duration) {
  if (!bar) {
    return;
  }

  bar.classList.remove('progress__bar--animate');
  bar.style.transitionDuration = `${duration}ms`;
  bar.style.width = '0%';
  void bar.offsetWidth;

  if (duration === 0) {
    bar.style.width = '100%';
    return;
  }

  bar.classList.add('progress__bar--animate');
}

function resetProgressBar(bar) {
  if (!bar) {
    return;
  }

  bar.classList.remove('progress__bar--animate');
  bar.style.transitionDuration = '';
  bar.style.width = '0%';
}

function animateProgressLabel(label, duration) {
  if (!label) {
    return;
  }

  cancelProgressLabelAnimation(label);

  if (duration === 0) {
    label.textContent = '100%';
    return;
  }

  label.textContent = '0%';
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    label.textContent = `${Math.round(progress * 100)}%`;

    if (progress < 1) {
      const frameId = requestAnimationFrame(update);
      label.dataset.progressAnimationFrame = String(frameId);
    } else {
      delete label.dataset.progressAnimationFrame;
    }
  }

  const frameId = requestAnimationFrame(update);
  label.dataset.progressAnimationFrame = String(frameId);
}

function resetProgressLabel(label) {
  if (!label) {
    return;
  }

  cancelProgressLabelAnimation(label);
  label.textContent = '0%';
}

function completeProgressLabel(label) {
  if (!label) {
    return;
  }

  cancelProgressLabelAnimation(label);
  label.textContent = '100%';
}

function cancelProgressLabelAnimation(label) {
  const frameId = Number.parseInt(label?.dataset?.progressAnimationFrame ?? '', 10);
  if (Number.isFinite(frameId)) {
    cancelAnimationFrame(frameId);
  }
  if (label?.dataset) {
    delete label.dataset.progressAnimationFrame;
  }
}

function shouldReduceMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
