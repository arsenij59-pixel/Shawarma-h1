/* ================= НАСТРОЙКИ ================= */
const CONFIG = {
  deliveryFee: 150,
  freeFrom: 800,
  storageKey: 'shawarma-cart-v2',
  toastDuration: 2400,
};

/* ================= ХЕЛПЕРЫ ================= */
const money = n => n.toLocaleString('ru-RU') + ' ₽';
const productById = id => PRODUCTS.find(p => p.id === id);
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/* ================= СОСТОЯНИЕ КОРЗИНЫ ================= */
const cart = (() => {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
})();

function persist() {
  try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(cart)); }
  catch {}
}

function cartSummary() {
  let subtotal = 0, count = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const p = productById(id);
    if (!p) continue;
    subtotal += p.price * qty;
    count += qty;
  }
  const delivery = count === 0 || subtotal >= CONFIG.freeFrom ? 0 : CONFIG.deliveryFee;
  return { subtotal, count, delivery, total: subtotal + delivery };
}

/* ================= РЕНДЕР МЕНЮ ================= */
const menuGrid = $('#menuGrid');

function renderMenu(category = 'all') {
  const items = category === 'all'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.cat === category);

  menuGrid.innerHTML = items.map(p => `
    <article class="menu-card reveal">
      <div class="card-image">
        ${p.hit ? '<span class="hit-tag">хит</span>' : ''}
        ${p.emoji}
      </div>
      <h3 class="card-name">${p.name}</h3>
      <p class="card-desc">${p.desc}</p>
      <div class="card-bottom">
        <span class="price-tag">${money(p.price)}</span>
        <button class="add-btn" data-add="${p.id}" aria-label="Добавить ${p.name}">+</button>
      </div>
    </article>
  `).join('');

  // повторно применяем анимацию появления к новым карточкам
  requestAnimationFrame(() => {
    menuGrid.querySelectorAll('.reveal').forEach((el, i) => {
      el.style.transitionDelay = (i % 6) * 40 + 'ms';
      el.classList.add('visible');
    });
  });
}
renderMenu();

/* ================= ФИЛЬТРЫ ================= */
$('#filters').addEventListener('click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  $$('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderMenu(btn.dataset.cat);
});

/* ================= ДОБАВЛЕНИЕ В КОРЗИНУ ================= */
menuGrid.addEventListener('click', e => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const id = btn.dataset.add;
  cart[id] = (cart[id] || 0) + 1;
  persist();
  updateBadge(true);
  renderCart();
  const p = productById(id);
  toast(`Добавлено: ${p.name}`);
});

function updateBadge(bump = false) {
  const { count } = cartSummary();
  const badge = $('#cartBadge');
  badge.textContent = count;
  if (bump) {
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
  }
}
updateBadge();

/* ================= РЕНДЕР КОРЗИНЫ ================= */
const drawerBody = $('#drawerBody');
const drawerFoot = $('#drawerFoot');
const drawerTitle = $('#drawerTitle');

function renderCart() {
  const entries = Object.entries(cart).filter(([id]) => productById(id));

  if (entries.length === 0) {
    drawerTitle.textContent = 'Корзина';
    drawerBody.innerHTML = `
      <div class="empty-cart">
        <div class="e-ico">🌯</div>
        <strong>Пока пусто</strong>
        <span>Добавь что-нибудь из меню — и мы всё соберём</span>
      </div>`;
    drawerFoot.innerHTML = '';
    return;
  }

  const { count } = cartSummary();
  drawerTitle.textContent = `Корзина · ${count}`;

  drawerBody.innerHTML = entries.map(([id, qty]) => {
    const p = productById(id);
    return `
      <div class="cart-line">
        <div class="cart-emoji">${p.emoji}</div>
        <div class="cart-info">
          <div class="cart-name">${p.name}</div>
          <div class="cart-price">${money(p.price * qty)}</div>
          <div class="qty">
            <button data-dec="${id}" aria-label="Меньше">−</button>
            <span>${qty}</span>
            <button data-inc="${id}" aria-label="Больше">+</button>
          </div>
        </div>
        <button class="cart-remove" data-del="${id}" aria-label="Удалить">✕</button>
      </div>
    `;
  }).join('');

  const t = cartSummary();
  const toFree = CONFIG.freeFrom - t.subtotal;

  drawerFoot.innerHTML = `
    <div class="sum-row"><span>Товары (${t.count})</span><span>${money(t.subtotal)}</span></div>
    <div class="sum-row"><span>Доставка</span><span>${t.delivery === 0 ? 'бесплатно' : money(t.delivery)}</span></div>
    ${t.delivery > 0 && toFree > 0 ? `<div class="hint">Добавь ещё на ${money(toFree)} — доставим бесплатно</div>` : ''}
    <div class="sum-row total"><span>Итого</span><span>${money(t.total)}</span></div>
    <button class="btn btn-primary btn-block" id="checkoutBtn">Оформить заказ</button>
  `;
}
renderCart();

/* Обработка кликов внутри корзины */
drawerBody.addEventListener('click', e => {
  const inc = e.target.closest('[data-inc]');
  const dec = e.target.closest('[data-dec]');
  const del = e.target.closest('[data-del]');

  if (inc) {
    cart[inc.dataset.inc]++;
  } else if (dec) {
    const id = dec.dataset.dec;
    cart[id]--;
    if (cart[id] <= 0) delete cart[id];
  } else if (del) {
    delete cart[del.dataset.del];
  } else return;

  persist();
  updateBadge();
  renderCart();
});

drawerFoot.addEventListener('click', e => {
  if (e.target.closest('#checkoutBtn')) checkout();
});

/* ================= ОФОРМЛЕНИЕ ЗАКАЗА ================= */
function checkout() {
  if (cartSummary().count === 0) return;
  const orderNum = Math.floor(1000 + Math.random() * 9000);
  const { total } = cartSummary();

  drawerTitle.textContent = 'Готово!';
  drawerBody.innerHTML = `
    <div class="success-state">
      <div class="ok">✓</div>
      <h3>Заказ №${orderNum}</h3>
      <p>Мы уже начали готовить. Перезвоним в течение 5 минут для подтверждения.</p>
      <div class="amount">${money(total)}</div>
    </div>`;
  drawerFoot.innerHTML = `
    <button class="btn btn-primary btn-block" id="closeSuccess">Отлично!</button>`;

  drawerFoot.querySelector('#closeSuccess').addEventListener('click', closeCart);

  // очистка
  Object.keys(cart).forEach(k => delete cart[k]);
  persist();
  updateBadge();
  toast(`Заказ №${orderNum} оформлен 🎉`);
}

/* ================= ОТКРЫТИЕ / ЗАКРЫТИЕ ================= */
const drawer = $('#drawer');
const overlay = $('#overlay');

function openCart() {
  renderCart();
  drawer.classList.add('open');
  overlay.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('locked');
}
function closeCart() {
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('locked');
  setTimeout(renderCart, 400);
}

$('#cartBtn').addEventListener('click', openCart);
$('#closeCart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCart(); closeMobile(); }
});

/* ================= ТОСТ ================= */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), CONFIG.toastDuration);
}

/* ================= ШАПКА ================= */
const header = $('#header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ================= МОБИЛЬНОЕ МЕНЮ ================= */
const burger = $('#burger');
const mobileMenu = $('#mobileMenu');

function closeMobile() {
  mobileMenu.classList.remove('open');
  burger.classList.remove('open');
}
burger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
  burger.classList.toggle('open');
});
mobileMenu.addEventListener('click', e => {
  if (e.target.tagName === 'A') closeMobile();
});

/* ================= ПОЯВЛЕНИЕ ПРИ СКРОЛЛЕ ================= */
const io = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = (i % 5) * 60 + 'ms';
  io.observe(el);
});
