const ORDER_STORAGE_KEY = 'frigorifico_orders';
const INVENTORY_STORAGE_KEY = 'frigorifico_inventory';

document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  const orderSection = document.getElementById('orderSection');
  const orderForm = document.getElementById('orderForm');
  const confirmationSection = document.getElementById('confirmation');
  const confirmationDetails = document.getElementById('confirmationDetails');
  const newOrderButton = document.getElementById('newOrder');

  orderForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(orderForm);

    const storeName = (formData.get('storeName') || '').toString().trim();
    const storeAddress = (formData.get('storeAddress') || '').toString().trim();
    const crateSize = formData.get('crateSize');

    if (!storeName || !storeAddress || !crateSize) {
      return;
    }

    const order = {
      storeName,
      storeAddress,
      crateSize,
      timestamp: Date.now()
    };

    persistOrder(order);

    const inventory = loadInventory();
    const crateData = inventory.find((item) => item.label.includes(crateSize));
    const details = [
      `<strong>Comercio:</strong> ${storeName}`,
      `<strong>Dirección:</strong> ${storeAddress}`,
      `<strong>Cajón solicitado:</strong> ${crateSize}`
    ];

    if (crateData) {
      details.push(`<strong>Precio vigente:</strong> ARS ${Number(crateData.price || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
      details.push(`<strong>Stock disponible:</strong> ${crateData.stock} cajones`);
    }

    confirmationDetails.innerHTML = details
      .map((detail) => `<p>${detail}</p>`)
      .join('');

    orderSection.classList.add('card--hidden');
    confirmationSection.classList.remove('card--hidden');
    orderForm.reset();
  });

  newOrderButton.addEventListener('click', () => {
    confirmationSection.classList.add('card--hidden');
    orderSection.classList.remove('card--hidden');
    confirmationDetails.innerHTML = '';
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
