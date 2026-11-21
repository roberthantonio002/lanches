'use strict';

/* ==========================================================
   CARDÁPIO DIGITAL COM CARRINHO E ENVIO PARA WHATSAPP
   ========================================================== */

const WHATSAPP_NUMBER = '5549999971074'; // Troque para o número do WhatsApp (com DDI + DDD, sem espaços ou símbolos)
const CART_KEY = 'bravaCart';

/* ---------- HORÁRIO DE FUNCIONAMENTO (EDITE AQUI) ----------
   Horário de Brasília. Use ['abre','fecha'] ou null para dia fechado.
   Ordem: Domingo, Segunda, Terça, Quarta, Quinta, Sexta, Sábado.
   Obs.: abre e fecha no mesmo dia (até 23:59). */
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const HORARIOS = [
  ['18:00', '23:30'], // Domingo
  null,               // Segunda (fechado)
  ['18:00', '23:30'], // Terça
  ['18:00', '23:30'], // Quarta
  ['18:00', '23:30'], // Quinta
  ['18:00', '23:30'], // Sexta
  ['18:00', '23:30']  // Sábado
];
// true = não deixa enviar pedido com a loja fechada
const BLOQUEAR_PEDIDO_FECHADO = true;

/* ---------- ADICIONAIS (EDITE NOMES E PREÇOS) ---------- */
const ADICIONAIS_LANCHE = [
  { id: 'bacon',   name: 'Bacon',            price: 5.00 },
  { id: 'cheddar', name: 'Cheddar extra',    price: 3.50 },
  { id: 'ovo',     name: 'Ovo',              price: 3.00 },
  { id: 'burger',  name: 'Hambúrguer extra', price: 9.00 }
];
const ADICIONAIS_PORCAO = [
  { id: 'molho', name: 'Molho extra', price: 3.00 }
];

/* ---------- LISTA DE PRODUTOS (EDITE AQUI) ---------- */
const menuItems = [
  {
    id: 'lanche-1', ativo: true, tag: 'Mais Pedido', category: 'Lanches',
    name: 'Brava Clássico',
    desc: 'Pão brioche, hambúrguer artesanal 160g, queijo cheddar derretido, alface, tomate e maionese da casa.',
    price: 26.90, adicionais: ADICIONAIS_LANCHE,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=85'
  },
  {
    id: 'lanche-2', ativo: true, tag: 'Duplo', category: 'Lanches',
    name: 'Brava Bacon Duplo',
    desc: 'Dois burgers de 140g, dobro de cheddar, fatias crocantes de bacon defumado e molho barbecue.',
    price: 34.90, adicionais: ADICIONAIS_LANCHE,
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=700&q=85'
  },
  {
    id: 'porcao-1', ativo: true, tag: '', category: 'Porções',
    name: 'Batata Rústica com Cheddar e Bacon',
    desc: 'Porção generosa (400g) de batatas crocantes cobertas com creme de cheddar e bacon picado.',
    price: 24.00, adicionais: ADICIONAIS_PORCAO,
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=85'
  },
  {
    id: 'porcao-2', ativo: true, tag: '', category: 'Porções',
    name: 'Anéis de Cebola (Onion Rings)',
    desc: '12 unidades de anéis de cebola empanados e super crocantes. Acompanha molho especial.',
    price: 19.90, adicionais: ADICIONAIS_PORCAO,
    image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=700&q=85'
  },
  {
    id: 'bebida-1', ativo: true, tag: '', category: 'Bebidas',
    name: 'Coca-Cola Lata 350ml',
    desc: 'Refrigerante bem gelado.',
    price: 6.50,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=700&q=85'
  },
  {
    id: 'bebida-2', ativo: true, tag: '', category: 'Bebidas',
    name: 'Suco Natural de Laranja 500ml',
    desc: 'Feito na hora, 100% natural e gelado.',
    price: 10.00,
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=700&q=85'
  }
];

/* ---------- ESTADO ---------- */
let activeCategory = 'Todos';
let cart = [];
let optProduct = null;

/* ---------- ELEMENTOS ---------- */
const $ = id => document.getElementById(id);
const menuGrid = $('menuGrid');
const filtersContainer = $('categoryFilters');
const cartDrawer = $('cartDrawer');
const cartOverlay = $('cartOverlay');
const cartItemsContainer = $('cartItems');
const cartFooter = $('cartFooter');
const cartCountEl = $('cartCount');
const cartTotalEl = $('cartTotal');
const stickyCart = $('stickyCart');
const optModal = $('optModal');
const optList = $('optList');
const optAddBtn = $('optAddBtn');
const confirmModal = $('confirmModal');
const checkoutBtn = $('checkoutBtn');

/* ---------- UTILITÁRIOS ---------- */
function formatBRL(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Escapa texto antes de inserir via innerHTML (proteção contra XSS)
function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function cartTotalPrice() {
  return cart.reduce((acc, item) => acc + item.price * item.qty, 0);
}

/* ---------- ABERTO / FECHADO ---------- */
function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Dia da semana e minutos atuais no horário de Brasília
function agoraSP() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { dia, min: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10) };
}

function getStatus() {
  const { dia, min } = agoraSP();
  const hoje = HORARIOS[dia];
  if (hoje) {
    const [abre, fecha] = hoje.map(toMin);
    if (min >= abre && min < fecha) return { aberto: true, texto: `Aberto agora • fecha às ${hoje[1]}` };
    if (min < abre) return { aberto: false, texto: `Fechado • abre hoje às ${hoje[0]}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (dia + i) % 7;
    if (HORARIOS[d]) {
      return { aberto: false, texto: `Fechado • abre ${i === 1 ? 'amanhã' : DIAS[d].toLowerCase()} às ${HORARIOS[d][0]}` };
    }
  }
  return { aberto: false, texto: 'Fechado' };
}

function renderHours() {
  const hoje = agoraSP().dia;
  $('hoursList').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(i => `
    <li class="${i === hoje ? 'today' : ''}">
      <span>${DIAS[i]}</span>
      <span>${HORARIOS[i] ? `${HORARIOS[i][0]} às ${HORARIOS[i][1]}` : 'Fechado'}</span>
    </li>
  `).join('');
}

function updateStatus() {
  const s = getStatus();
  const bloqueado = BLOQUEAR_PEDIDO_FECHADO && !s.aberto;
  const strip = $('storeStatus');
  strip.className = 'status-strip ' + (s.aberto ? 'open' : 'closed');
  strip.textContent = s.texto;
  $('statusText').textContent = s.texto;
  checkoutBtn.disabled = bloqueado;
  const note = $('closedNote');
  note.hidden = s.aberto;
  note.textContent = bloqueado
    ? 'Estamos fechados e não é possível enviar pedidos agora. Sua sacola fica guardada para você enviar quando abrirmos.'
    : 'Estamos fechados no momento. Seu pedido será respondido quando abrirmos.';
}

/* ---------- SACOLA: LINHAS, SALVAR E CARREGAR ---------- */
// Monta uma linha do carrinho (produto + adicionais escolhidos)
function buildLine(p, extraIds) {
  const extras = (p.adicionais || []).filter(a => extraIds.includes(a.id));
  return {
    key: p.id + '|' + extras.map(a => a.id).sort().join(','),
    id: p.id,
    name: p.name,
    extras: extras.map(a => a.id),
    extraNames: extras.map(a => a.name),
    price: p.price + extras.reduce((s, a) => s + a.price, 0),
    qty: 1
  };
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart.map(i => ({ id: i.id, extras: i.extras, qty: i.qty }))));
  } catch (e) { /* ignora */ }
}

// Recalcula nome e preço a partir do cardápio (ignora valores adulterados)
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY));
    if (!Array.isArray(saved)) return;
    cart = saved.map(s => {
      const p = menuItems.find(m => m.id === s.id && m.ativo !== false);
      if (!p) return null;
      const line = buildLine(p, Array.isArray(s.extras) ? s.extras : []);
      line.qty = Math.max(1, Math.min(99, parseInt(s.qty, 10) || 1));
      return line;
    }).filter(Boolean);
  } catch (e) { cart = []; }
}

/* ---------- RENDERIZAÇÃO ---------- */
function renderFilters() {
  const ativos = menuItems.filter(i => i.ativo !== false);
  const categories = ['Todos', ...new Set(ativos.map(i => i.category))];
  filtersContainer.innerHTML = categories.map(cat => `
    <button type="button" class="filter-btn ${cat === activeCategory ? 'active' : ''}" data-cat="${esc(cat)}">${esc(cat)}</button>
  `).join('');
}

function renderMenu() {
  const filtered = menuItems.filter(item => {
    if (item.ativo === false) return false;
    return activeCategory === 'Todos' || item.category === activeCategory;
  });

  menuGrid.innerHTML = filtered.map(item => `
    <article class="food-card">
      <div class="food-img">
        <img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">
        ${item.tag ? `<span class="food-tag">${esc(item.tag)}</span>` : ''}
      </div>
      <div class="food-body">
        <h3>${esc(item.name)}</h3>
        <p>${esc(item.desc)}</p>
        <div class="food-footer">
          <span class="food-price">${formatBRL(item.price)}</span>
          <button type="button" class="add-btn" data-add="${esc(item.id)}">+ Adicionar</button>
        </div>
      </div>
    </article>
  `).join('');
}

/* ---------- LÓGICA DO CARRINHO ---------- */
function handleAdd(id) {
  const p = menuItems.find(m => m.id === id && m.ativo !== false);
  if (!p) return;
  if (p.adicionais && p.adicionais.length) openOptions(p);
  else addToCart(id, []);
}

function addToCart(id, extraIds) {
  const p = menuItems.find(m => m.id === id && m.ativo !== false);
  if (!p) return;
  const line = buildLine(p, extraIds);
  const existing = cart.find(c => c.key === line.key);
  if (existing) existing.qty = Math.min(99, existing.qty + 1);
  else cart.push(line);
  updateCartUI();
  openCart();
}

function changeQty(key, delta) {
  const index = cart.findIndex(c => c.key === key);
  if (index === -1) return;
  cart[index].qty = Math.min(99, cart[index].qty + delta);
  if (cart[index].qty <= 0) cart.splice(index, 1);
  updateCartUI();
}

function updateCartUI() {
  saveCart();
  const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
  const total = cartTotalPrice();

  cartCountEl.textContent = totalQty;
  cartTotalEl.textContent = formatBRL(total);
  cartFooter.hidden = cart.length === 0;
  $('stickyInfo').textContent = `Ver sacola (${totalQty})`;
  $('stickyTotal').textContent = formatBRL(total);
  syncSticky();

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-cart">Sua sacola está vazia.<br>Escolha algo delicioso no cardápio!</p>';
    return;
  }

  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <h4>${esc(item.name)}</h4>
        ${item.extraNames.length ? `<small class="cart-extras">+ ${esc(item.extraNames.join(', '))}</small>` : ''}
        <span>${formatBRL(item.price * item.qty)}</span>
      </div>
      <div class="qty-controls">
        <button type="button" class="qty-btn" data-qty="${esc(item.key)}" data-delta="-1" aria-label="Diminuir">-</button>
        <strong>${item.qty}</strong>
        <button type="button" class="qty-btn" data-qty="${esc(item.key)}" data-delta="1" aria-label="Aumentar">+</button>
      </div>
    </div>
  `).join('');
}

/* ---------- ABRIR / FECHAR (SACOLA E MODAIS) ---------- */
function syncScroll() {
  const aberto = cartDrawer.classList.contains('open') || !optModal.hidden || !confirmModal.hidden;
  document.body.classList.toggle('no-scroll', aberto);
}

// Botão fixo "Ver sacola": só com itens e com a gaveta fechada
function syncSticky() {
  const show = cart.length > 0 && !cartDrawer.classList.contains('open');
  stickyCart.hidden = !show;
  document.body.classList.toggle('has-sticky', show);
}

function openCart() {
  cartDrawer.classList.add('open');
  cartOverlay.classList.add('open');
  syncScroll();
  syncSticky();
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartOverlay.classList.remove('open');
  syncScroll();
  syncSticky();
}

function showModal(m) { m.hidden = false; syncScroll(); }
function hideModal(m) { m.hidden = true; syncScroll(); }

/* ---------- MODAL DE ADICIONAIS ---------- */
function optSelected() {
  return [...optList.querySelectorAll('input:checked')].map(i => i.value);
}

function updateOptTotal() {
  optAddBtn.textContent = `Adicionar • ${formatBRL(buildLine(optProduct, optSelected()).price)}`;
}

function openOptions(p) {
  optProduct = p;
  $('optTitle').textContent = p.name;
  $('optDesc').textContent = p.desc;
  optList.innerHTML = p.adicionais.map(a => `
    <label class="opt-row">
      <span class="opt-name"><input type="checkbox" value="${esc(a.id)}"> ${esc(a.name)}</span>
      <span class="opt-price">+ ${formatBRL(a.price)}</span>
    </label>
  `).join('');
  updateOptTotal();
  showModal(optModal);
}

/* ---------- FINALIZAR PEDIDO NO WHATSAPP ---------- */
function checkoutWhatsApp() {
  if (cart.length === 0) {
    alert('Adicione pelo menos um item à sacola antes de concluir o pedido!');
    return;
  }

  const status = getStatus();
  if (BLOQUEAR_PEDIDO_FECHADO && !status.aberto) {
    alert(`Estamos fechados no momento. ${status.texto}`);
    return;
  }

  const nameInput = $('customerName');
  const name = nameInput.value.trim();
  if (!name) {
    alert('Informe seu nome para concluir o pedido.');
    nameInput.focus();
    return;
  }

  const address = $('customerAddress').value.trim() || 'A combinar / Retirada';
  const payment = $('paymentMethod').value;
  const notes = $('orderNotes').value.trim();
  const orderId = 'BB' + Date.now().toString(36).slice(-4).toUpperCase();
  const total = cartTotalPrice();

  const itemsText = cart
    .map(i => `• ${i.qty}x ${i.name} — ${formatBRL(i.price * i.qty)}` + (i.extraNames.length ? `\n   + ${i.extraNames.join(', ')}` : ''))
    .join('\n');

  let message = `*NOVO PEDIDO - BRAVA BURGER*\n`;
  message += `*Pedido:* #${orderId}\n\n`;
  message += `*Itens do pedido:*\n${itemsText}\n\n`;
  message += `*Total:* ${formatBRL(total)}\n`;
  message += `------------------------------\n`;
  message += `*Cliente:* ${name}\n`;
  message += `*Entrega:* ${address}\n`;
  message += `*Forma de Pagamento:* ${payment}\n`;
  if (notes) message += `*Observações:* ${notes}\n`;

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');

  $('confirmId').textContent = '#' + orderId;
  $('confirmTotal').textContent = formatBRL(total);
  $('confirmWpp').href = url;
  showModal(confirmModal);
}

/* ---------- EVENTOS ---------- */
filtersContainer.addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  renderFilters();
  renderMenu();
});

menuGrid.addEventListener('click', e => {
  const btn = e.target.closest('[data-add]');
  if (btn) handleAdd(btn.dataset.add);
});

cartItemsContainer.addEventListener('click', e => {
  const btn = e.target.closest('[data-qty]');
  if (btn) changeQty(btn.dataset.qty, Number(btn.dataset.delta));
});

optList.addEventListener('change', updateOptTotal);
optAddBtn.addEventListener('click', () => {
  const id = optProduct.id;
  const extras = optSelected();
  hideModal(optModal);
  addToCart(id, extras);
});

document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-close-modal]')) hideModal(m);
  });
});

$('confirmNewBtn').addEventListener('click', () => {
  cart = [];
  $('orderNotes').value = '';
  updateCartUI();
  hideModal(confirmModal);
  closeCart();
});

$('openCartBtn').addEventListener('click', openCart);
$('closeCartBtn').addEventListener('click', closeCart);
stickyCart.addEventListener('click', openCart);
cartOverlay.addEventListener('click', closeCart);
checkoutBtn.addEventListener('click', checkoutWhatsApp);

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!optModal.hidden) hideModal(optModal);
  else if (!confirmModal.hidden) hideModal(confirmModal);
  else closeCart();
});

/* ---------- INICIALIZAÇÃO ---------- */
loadCart();
renderFilters();
renderMenu();
updateCartUI();
renderHours();
updateStatus();
setInterval(updateStatus, 60000);
$('ano').textContent = new Date().getFullYear();

// Se a logo ainda não existir, esconde a imagem quebrada
document.querySelectorAll('.cart-logo').forEach(img => {
  const hide = () => img.remove();
  img.addEventListener('error', hide);
  if (img.complete && img.naturalWidth === 0) hide();
});