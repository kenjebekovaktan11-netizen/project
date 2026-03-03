
const burger = document.querySelector('.burger');
if (burger) {
  burger.addEventListener('click', () => burger.classList.toggle('active'));
}


let allCars = [];
const detailsContent = document.getElementById('detailsContent');
const API = (window.API_BASE || "").trim()
  ? `${window.API_BASE.replace(/\/$/, "")}/api`
  : "http://127.0.0.1:5000/api";
let currentChip = 'Все';
let favorites = new Set();
let showOnlyMine = false;
let showFavMine = false;
let currentUser = null;

function getToken() {
  const t = (localStorage.getItem('token') || '').trim();
  if (!t || t.split('.').length !== 3) return '';
  return t;
}



async function loadFavoritesFromServer() {
  const token = getToken();


  if (!token) {
    favorites = new Set();
    return;
  }

  try {
    const res = await fetch(`${API}/favorites`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      favorites = new Set();
      return;
    }

    const ids = await res.json(); 
    favorites = new Set((ids || []).map(String));

  } catch (e) {
    console.error("FAVORITES LOAD ERROR:", e);
    favorites = new Set();
  }
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('role');
  localStorage.removeItem('userId');
  currentUser = null;
  favorites = new Set();
}

function setAuth( token, role, userId, email, name) {
  if (token) localStorage.setItem('token', token);
  if (role) localStorage.setItem('role', role);
  if (userId != null) localStorage.setItem('userId', String(userId));

  setCurrentUser({
    id: userId,
    name: name || (email ? email.split('@')[0] : 'Пользователь'),
    email: email || ''
  });
}




function getMainImage(car) {
  if (car && Array.isArray(car.images) && car.images.length) return car.images[0];
  if (car && car.image) return car.image;
  return 'images/placeholder.jpg';
}

function parseSom(priceStr) {
  if (!priceStr) return NaN;
  return parseInt(String(priceStr).replace(/\s/g, '').replace('сом', '').trim(), 10);
}

function getSearchFilters() {
  const brandSelect = document.querySelector('select');
  const modelInput = document.querySelector('input[placeholder="Например: Camry"]');
  const yearFromInput = document.querySelector('input[placeholder="2015"]');
  const priceToInput = document.querySelector('input[placeholder="1500000"]');

  return {
    brand: brandSelect ? brandSelect.value : 'Любая',
    model: modelInput ? modelInput.value.toLowerCase().trim() : '',
    yearFrom: yearFromInput ? yearFromInput.value.trim() : '',
    priceTo: priceToInput ? priceToInput.value.trim() : ''
  };
}

function applyAllFilters() {
  const { brand, model, yearFrom, priceTo } = getSearchFilters();
  let filtered = allCars.slice();

  if (currentChip === 'Седаны') filtered = filtered.filter(c => c.type === 'car');
  else if (currentChip === 'Кроссоверы') filtered = filtered.filter(c => c.type === 'suv');
  else if (currentChip === 'Электро') filtered = filtered.filter(c => c.type === 'electric');
  else if (currentChip === 'Мотоциклы') filtered = filtered.filter(c => c.type === 'motorcycle');
  else if (currentChip === 'Лодки') filtered = filtered.filter(c => c.type === 'boat');
  else if (currentChip === 'Пикапы') filtered = filtered.filter(c => c.type === 'pickup');
  if (showOnlyMine) {
    const me = getCurrentUser();
    if (!me) {
      showOnlyMine = false;
    }
    else {
       const myId = me ? String(me.id) : '';
       filtered = filtered.filter(car => String(car.ownerId) === myId);
    }
   
  }
 if (showFavMine) {
  filtered = filtered.filter(car => favorites.has(String(car.id)));
}
  
  filtered = filtered.filter(car => {
    const cleanPrice = parseSom(car.price);

    const matchBrand = brand === 'Любая' || car.brand === brand;
    const matchModel = !model || String(car.model).toLowerCase().includes(model);
    const matchYear = !yearFrom || car.year >= parseInt(yearFrom, 10);
    const matchPrice = !priceTo || cleanPrice <= parseInt(priceTo, 10);

    return matchBrand && matchModel && matchYear && matchPrice;
  });

  renderCars(filtered);
}

function renderCars(cars) {
  const grid = document.querySelector('.grid');
  if (!grid) return;
  

  grid.innerHTML = '';

  if (!cars || cars.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;">Ничего не найдено</p>';
    return;
  }

  cars.forEach(car => {
    const isFav = favorites.has(String(car.id));
    const role = (localStorage.getItem('role') || '').toLowerCase();
    const me = getCurrentUser();
    const myId = me ? String(me.id) : '';
    const canDelete = role === 'admin' || (myId && String(car.ownerId) === myId);
    const city = car.city || car.location || '';
    const card = document.createElement('article');
    card.className = 'card';

    card.innerHTML = `
      <div class="card__media">
        <img src="${getMainImage(car)}" alt="${car.brand} ${car.model}" width="100%" height="100%">
        ${car.badge ? `<div class="badge">${car.badge}</div>` : ''}
      </div>
      <div class="card__body">
        <div class="card__top">
          <h3 class="card__title">${car.brand} ${car.model}</h3>
          <div class="price">${car.price}</div>
        </div>
        <div class="meta">
          <span>${car.year ?? ''}</span><span>•</span>
          <span>${car.engine ?? ''}</span><span>•</span>
          <span>${car.km ?? ''}</span>
        </div>
        <div class="tags">
          <span class="tag">${city}</span>
          <span class="tag">${car.owner ?? ''}</span>
          <span class="tag">${car.condition ?? ''}</span>
        </div>
        <div class="card__actions">
          <button class="btn btn--ghost fav-btn" data-id="${car.id}" type="button">
  ${isFav ? 'В избранном' : 'В избранное'}
</button>
          <button class="btn btn--primary details-btn" data-id="${car.id}" type="button">Подробнее</button>
          ${canDelete ? `<button class="btn btn--ghost delete-btn" data-id="${car.id}" type="button">Удалить</button>` : ''}
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}
async function loadMeFromServer() {
  const token = getToken();
  if (!token) { currentUser = null; return null; }

  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) { currentUser = null; return null; }

  const me = await res.json(); 
  currentUser = { id: me.id, role: me.role || "user" };
  localStorage.setItem('role', currentUser.role);
  localStorage.setItem('userId', String(currentUser.id));
  return currentUser;
}
async function loadUserCars() {
  const res = await fetch(`${API}/cars`);
  if (!res.ok) return [];
  return await res.json();
}

(async function initCatalog() {
  try {
     await loadFavoritesFromServer();
    const cars = await fetch('cars.json').then(r => r.json());
    const savedCars = await loadUserCars();

    const carsWithId = cars.map((car, i) => ({
      ...car,
      id: car.id ?? `json_${i}`
    }));
    const me = getCurrentUser(); 
    const myId = me ? String(me.id) : null;

    const savedWithId = savedCars.map(car => ({
      ...car,
      isUser: myId && String(car.ownerId) === myId
    }));

    allCars = [...savedWithId, ...carsWithId];
    allCars = allCars.map((c, i) => ({ ...c, id: c.id ?? `tmp_${i}` }));

    applyAllFilters();
    updateProfileStats();
  } catch (e) {
    const grid = document.querySelector('.grid');
    if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;">Ошибка загрузки каталога</p>';
  }
})();


const searchBtn = document.querySelector('.search__btn');
if (searchBtn) searchBtn.addEventListener('click', () => applyAllFilters());

const chips = document.querySelectorAll('.chip');
if (chips.length) {
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      currentChip = chip.textContent.trim();
      showOnlyMine = false;
      showFavMine = false;
      applyAllFilters();
    });
  });
}


const addAdBtn = document.querySelector('.add-ad-btn');
const modal = document.getElementById('adModal');
const closeModal = document.getElementById('closeModal');
const submitAd = document.getElementById('submitAd');

if (addAdBtn && modal) addAdBtn.addEventListener('click', () => modal.classList.add('active'));
if (closeModal && modal) closeModal.addEventListener('click', () => modal.classList.remove('active'));

let isSubmittingAd = false;

if (submitAd) {
  submitAd.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isSubmittingAd) return;
    isSubmittingAd = true;
    submitAd.disabled = true;

    try {
      const brand = document.getElementById('adBrand')?.value.trim();
      const model = document.getElementById('adModel')?.value.trim();
      const year = parseInt(document.getElementById('adYear')?.value, 10);
      const price = document.getElementById('adPrice')?.value.trim();
      const cleanPrice = price ? price.replace(/\D/g, '') : '';
      const type = document.getElementById('adType')?.value || 'car';

      const condition = document.getElementById('adCondition')?.value || '';
      const km = document.getElementById('adKm')?.value || '';
      const location = document.getElementById('adLocation')?.value || '';
      const engine = document.getElementById('adEngine')?.value || '';
      const owner = document.getElementById('adOwner')?.value || '';
      const description = document.getElementById('adDescription')?.value || '';

      const filesInput = document.getElementById('adImages');
      const files = filesInput ? filesInput.files : null;

      if (!brand || !model || Number.isNaN(year) || !price) {
        alert('Заполните все поля');
        return;
      }
      if (!files || files.length === 0) {
        alert('Добавьте хотя бы 1 фотографию');
        return;
      }
      if (files.length > 10) {
        alert('Максимум 10 фото');
        return;
      }

      const formData = new FormData();
      formData.append('brand', brand);
      formData.append('model', model);
      formData.append('year', String(year));
      formData.append('price', cleanPrice);
      formData.append('type', type);

      formData.append('condition', condition);
      formData.append('km', km);
      formData.append('city', location);
      formData.append('engine', engine);
      formData.append('owner', owner);
      formData.append('description', description);

      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }

      const token = getToken();
      if (!token) { alert("Сначала войдите"); return; }
      const headers = { Authorization: `Bearer ${token}` };

      const res = await fetch(`${API}/cars`, {
        method: 'POST',
        headers,
        body: formData
      });

      const text = await res.text();
      let createdCar = {};
      try { createdCar = JSON.parse(text); } catch { createdCar = {}; }

      if (!res.ok) {
        alert(createdCar.error || `Ошибка сервера: ${res.status}`);
        return;
      }

      allCars.unshift(createdCar);
      applyAllFilters();
      updateProfileStats();
      if (modal) modal.classList.remove('active');

    } catch (err) {
      console.error("SUBMIT CATCH:", err);
    } finally {
      isSubmittingAd = false;
      submitAd.disabled = false;
    }
  });
}


document.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('.delete-btn');
  if (!deleteBtn) return;

  const id = deleteBtn.dataset.id;

  try {
    const token = getToken();
    if (!token) {
      alert("Нужно войти, чтобы удалять объявления");
      return;
    }

    const res = await fetch(`${API}/cars/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    const raw = await res.text().catch(() => "");
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}

    if (!res.ok) {
      alert(data.error || raw || `Ошибка удаления: ${res.status}`);
      return;
    }
    favorites.delete(String(id));
    allCars = allCars.filter(c => String(c.id) !== String(id));
    applyAllFilters();
    updateProfileStats();
    updateProfileStats();
  } catch (error) {
    console.error(error);
    alert("Flask сервер не запущен");
  }
});


const detailsModal = document.getElementById('detailsModal');
const closeDetails = document.getElementById('closeDetails');
const detailsFav = document.getElementById('detailsFav');
const detailsCall = document.getElementById('detailsCall');
const detailsWa = document.getElementById('detailsWa');

let openedCarId = null;
function updateProfileStats() {
  const me = getCurrentUser();
  if (!me) return;

  const myId = String(me.id);

  const myAdsCount = allCars.filter(c => String(c.ownerId) === myId).length;
  const favCount = favorites.size;

  const myAdsEl = document.getElementById("pMyAdsCount");
  const favEl = document.getElementById("pFavCount");

  if (myAdsEl) myAdsEl.textContent = myAdsCount;
  if (favEl) favEl.textContent = favCount;
}

function openDetailsById(id) {
  const car = allCars.find(c => String(c.id) === String(id));
  if (!car || !detailsContent) return;

  openedCarId = car.id;
  const city = car.city || car.location || '';

  detailsContent.innerHTML = `
    <div class="details_hero">
      <div class="details_img">
        <img class="details_main_img" src="${getMainImage(car)}" alt="${car.brand} ${car.model}">
        ${
          Array.isArray(car.images) && car.images.length > 1
            ? `<div class="details_thumbs">
                ${car.images.map((url, i) => `
                  <button class="thumb-btn" type="button" data-i="${i}">
                    <img src="${url}" alt="Фото ${i + 1}">
                  </button>
                `).join('')}
              </div>`
            : ''
        }
      </div>

      <div class="details_info">
        <h3>${car.brand} ${car.model}</h3>
        <div><b>Цена:</b> ${car.price ?? ''}</div>
        <div><b>Год:</b> ${car.year ?? ''}</div>
        <div><b>Двигатель:</b> ${car.engine ?? ''}</div>
        <div><b>Пробег:</b> ${car.km ?? ''}</div>
        <div><b>Город:</b> ${city}</div>
        <div><b>Состояние:</b> ${car.condition ?? ''}</div>

        <button class="btn btn--primary contact-btn" type="button">Диогностика</button>
        <button class="btn btn-primary Images-btn" type="button">Фотографии</button>
      </div>
    </div>
  `;

  const phone = car.phone ? String(car.phone).replace(/\D/g, '') : '';
  if (detailsCall && detailsWa) {
    if (phone) {
      detailsCall.href = `tel:+${phone}`;
      detailsWa.href = `https://wa.me/${phone}`;
      detailsCall.style.pointerEvents = 'auto';
      detailsWa.style.pointerEvents = 'auto';
      detailsCall.style.opacity = '1';
      detailsWa.style.opacity = '1';
    } else {
      detailsCall.href = '#';
      detailsWa.href = '#';
      detailsCall.style.pointerEvents = 'none';
      detailsWa.style.pointerEvents = 'none';
      detailsCall.style.opacity = '.5';
      detailsWa.style.opacity = '.5';
    }
  }

  if (detailsModal) detailsModal.classList.add('active');
}

if (detailsContent) {
  detailsContent.addEventListener('click', (e) => {
    const btn = e.target.closest('.thumb-btn');
    if (!btn) return;

    const i = Number(btn.dataset.i);
    if (Number.isNaN(i)) return;

    const car = allCars.find(c => String(c.id) === String(openedCarId));
    if (!car || !Array.isArray(car.images) || !car.images[i]) return;

    const mainImg = detailsContent.querySelector('.details_main_img');
    if (mainImg) mainImg.src = car.images[i];
  });
}

document.addEventListener('click', (e) => {
  const detailsBtn = e.target.closest('.details-btn');
  if (detailsBtn) openDetailsById(detailsBtn.dataset.id);
});

if (closeDetails) {
  closeDetails.addEventListener('click', () => {
    if (detailsModal) detailsModal.classList.remove('active');
    openedCarId = null;
  });
}


function getFavorites() {
  return new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));
}
function saveFavorites(set) {
  localStorage.setItem('favorites', JSON.stringify([...set]));
}
async function toggleFavorite(id) {
  const token = getToken();
  if (!token) {
    alert("Сначала войдите");
    return false;
  }

  const carId = String(id);
  const isFavNow = favorites.has(carId);

  const method = isFavNow ? "DELETE" : "POST";

  const res = await fetch(`${API}/favorites/${encodeURIComponent(carId)}`, {
    method,
    headers: { Authorization: `Bearer ${token}` }
  });

  const raw = await res.text().catch(() => "");
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}

  if (!res.ok) {
    alert(data.error || raw || `Ошибка избранного: ${res.status}`);
    return favorites.has(carId);
  }

 
  if (isFavNow) favorites.delete(carId);
  else favorites.add(carId);

  return favorites.has(carId);
}

document.addEventListener('click', async (e) => {
  const favBtn = e.target.closest('.fav-btn');
  if (!favBtn) return;

  const isFav = await toggleFavorite(favBtn.dataset.id);
  favBtn.textContent = isFav ? 'В избранном' : 'В избранное';
  applyAllFilters();
  updateProfileStats();
});

if (detailsFav) {
  detailsFav.addEventListener('click', async () => {
    if (!openedCarId) return;
    const isFav = await toggleFavorite(openedCarId);
    detailsFav.textContent = isFav ? 'В избранном' : 'В избранное';
  });
}

const contactModal = document.getElementById('contactModal');
const contactInfo = document.getElementById('contactInfo');
const closeContact = document.getElementById('closeContact');

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('contact-btn')) {
    if (detailsModal) detailsModal.classList.remove('active');
    if (contactInfo) contactInfo.textContent = "пока пусто :)";
    if (contactModal) contactModal.classList.add('active');
  }
});
if (closeContact) {
  closeContact.addEventListener('click', () => {
    if (contactModal) contactModal.classList.remove('active');
  });
}

const ImagesModal = document.getElementById('ImagesModal');
const ImagesInfo = document.getElementById('ImagesInfo');
const closeImages = document.getElementById('closeImages');

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('Images-btn')) {
    if (detailsModal) detailsModal.classList.remove('active');
    if (ImagesInfo) ImagesInfo.textContent = "пока фотографий нет :))";
    if (ImagesModal) ImagesModal.classList.add('active');
  }
});
if (closeImages) {
  closeImages.addEventListener('click', () => {
    if (ImagesModal) ImagesModal.classList.remove('active');
  });
}

const authModal = document.getElementById('authModal');
const openAuth = document.getElementById('openAuth');
const closeAuth = document.getElementById('closeAuth');

const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const authTitle = document.getElementById('authTitle');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const loginMsg = document.getElementById('loginMsg');
const regMsg = document.getElementById('regMsg');

function openModalByEl(modalEl) {
  if (modalEl) modalEl.classList.add('active');
}
function closeModalByEl(modalEl) {
  if (modalEl) modalEl.classList.remove('active');
}

const accountMenu = document.getElementById('accountMenu');
const accountName = document.getElementById('accountName');
const accountEmail = document.getElementById('accountEmail');
const accountAvatar = document.getElementById('accountAvatar');
const accountLogout = document.getElementById('accountLogout');

const accountProfile = document.getElementById('accountProfile');
const accountMyAds = document.getElementById('accountMyAds');
const accountFavs = document.getElementById('accountFavs');

function getInitials(nameOrEmail) {
  const s = String(nameOrEmail || '').trim();
  return s ? s[0].toUpperCase() : 'A';
}

function updateAccountUI() {
  const user = getCurrentUser();

  if (!user) {
    if (openAuth) openAuth.textContent = 'Войти';
    if (accountMenu) accountMenu.classList.remove('is-open');
    return;
  }

  if (openAuth) openAuth.textContent = `${user.name} ▾`;
  if (accountName) accountName.textContent = user.name || 'Пользователь';
  if (accountEmail) accountEmail.textContent = user.email || '';
  if (accountAvatar) accountAvatar.textContent = getInitials(user.name || user.email);
}

function showLogin() {
  if (authTitle) authTitle.textContent = 'Вход';
  if (tabLogin) tabLogin.classList.add('auth__tab--active');
  if (tabRegister) tabRegister.classList.remove('auth__tab--active');
  if (loginForm) loginForm.style.display = 'flex';
  if (registerForm) registerForm.style.display = 'none';
  if (loginMsg) loginMsg.textContent = '';
  if (regMsg) regMsg.textContent = '';
}

function showRegister() {
  if (authTitle) authTitle.textContent = 'Регистрация';
  if (tabRegister) tabRegister.classList.add('auth__tab--active');
  if (tabLogin) tabLogin.classList.remove('auth__tab--active');
  if (registerForm) registerForm.style.display = 'flex';
  if (loginForm) loginForm.style.display = 'none';
  if (loginMsg) loginMsg.textContent = '';
  if (regMsg) regMsg.textContent = '';
}

if (openAuth) {
  openAuth.addEventListener('click', () => {
    const user = getCurrentUser();

    if (!user) {
      showLogin();
      openModalByEl(authModal);
      return;
    }
    if (accountMenu) accountMenu.classList.toggle('is-open');
  });
}

document.addEventListener('click', (e) => {
  if (!accountMenu || !accountMenu.classList.contains('is-open')) return;

  const wrap = document.getElementById('accountWidget');
  if (wrap && !wrap.contains(e.target)) {
    accountMenu.classList.remove('is-open');
  }
});

if (accountLogout) {
  accountLogout.addEventListener('click', () => {
    logout();
    favorites = new Set();
    if (accountMenu) accountMenu.classList.remove('is-open');
    updateAccountUI();
    applyAllFilters();
    
  });
}



const profileModal = document.getElementById('profileModal');
const closeProfile = document.getElementById('closeProfile');
const saveProfile = document.getElementById('saveProfile');

const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileRole = document.getElementById('profileRole');
const profileCreated = document.getElementById('profileCreated');
const profileMsg = document.getElementById('profileMsg');

async function openProfile() {
  const token = getToken();
  if (!token) { alert("Сначала войдите"); return; }

  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) { alert("Не удалось загрузить профиль"); return; }

  const me = await res.json();

  if (profileName) profileName.value = me.name || "";
  if (profileEmail) profileEmail.value = me.email || "";
  if (profileRole) profileRole.value = me.role || "";
  if (profileCreated) profileCreated.value = me.createdAt || "";
  if (profileMsg) profileMsg.textContent = "";

  if (profileModal) profileModal.classList.add("active");
}

if (accountProfile) accountProfile.addEventListener("click", openProfile);
if (closeProfile) closeProfile.addEventListener("click", () => profileModal?.classList.remove("active"));

if (saveProfile) {
  saveProfile.addEventListener("click", async () => {
    const token = getToken();
    if (!token) return;

    const name = (profileName?.value || "").trim();
    if (!name) { if (profileMsg) profileMsg.textContent = "Введите имя"; return; }

    const res = await fetch(`${API}/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });

    const raw = await res.text().catch(() => "");
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}

    if (!res.ok) {
      if (profileMsg) profileMsg.textContent = data.error || "Ошибка сохранения";
      return;
    }

    setCurrentUser({ id: data.id, name: data.name, email: data.email });
    updateAccountUI();

    if (profileMsg) profileMsg.textContent = "Сохранено ✅";
  });
}
if (accountMyAds) {
  accountMyAds.addEventListener('click',() => {
    const me = getCurrentUser();
    if (!me) {
      alert("Сначала войдите");
      return;
    }
    showOnlyMine = !showOnlyMine;
    showFavMine = false
    applyAllFilters();

  });
}
if (accountFavs) accountFavs.addEventListener('click', () => {
  const me = getCurrentUser();
  if (!me) {
    alert("Сначала войдите");
    return;
  }
  showFavMine = !showFavMine;
  showOnlyMine = false;
  applyAllFilters();

});

if (closeAuth && authModal) closeAuth.addEventListener('click', () => closeModalByEl(authModal));
if (authModal) {
  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeModalByEl(authModal);
  });
}

if (tabLogin) tabLogin.addEventListener('click', showLogin);
if (tabRegister) tabRegister.addEventListener('click', showRegister);


if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('regName')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('regPassword')?.value;

    if (!name || !email || !password) return;

    try {

      const regRes = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const regRaw = await regRes.text().catch(() => "");
      let regData = {};
      try { regData = regRaw ? JSON.parse(regRaw) : {}; } catch {}

      if (!regRes.ok) {
        if (regMsg) regMsg.textContent = regData.error || regRaw || `Ошибка регистрации: ${regRes.status}`;
        return;
      }

      // 2) auto login to get token
      const logRes = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const logRaw = await logRes.text().catch(() => "");
      let logData = {};
      try { logData = logRaw ? JSON.parse(logRaw) : {}; } catch {}

      if (!logRes.ok) {
        if (regMsg) regMsg.textContent = logData.error || logRaw || `Регистрация ок, но вход не удался: ${logRes.status}`;
        return;
      }

      setAuth(logData.token, logData.role, logData.userId, email, name);
      await loadFavoritesFromServer();
      if (regMsg) regMsg.textContent = 'Аккаунт создан. Вы вошли.';
      closeModalByEl(authModal);
      updateAccountUI();
      applyAllFilters();

    } catch (err) {
      console.error("REGISTER ERROR:", err);
      if (regMsg) regMsg.textContent = "Сервер не запущен (Flask)";
    }
  });
}


if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) return;

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const raw = await res.text().catch(() => "");
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {}

      if (!res.ok) {
        if (loginMsg) loginMsg.textContent = data.error || raw || `Ошибка входа: ${res.status}`;
        return;
      }

      setAuth(data.token, data.role, data.userId, email, email.split('@')[0]);
      await loadMeFromServer();          
      await loadFavoritesFromServer();   
applyAllFilters();  
      if (loginMsg) loginMsg.textContent = "Успешный вход";
      closeModalByEl(authModal);
      updateAccountUI();
      applyAllFilters();

    } catch (err) {
      console.error("LOGIN FETCH ERROR:", err);
      if (loginMsg) loginMsg.textContent = "Сервер не запущен (Flask)";
    }
  });
}


updateAccountUI();


const closeModalOverlay = document.getElementById('closeModalOverlay');
const closeModal2 = document.getElementById('closeModal2');

if (closeModalOverlay && modal) closeModalOverlay.addEventListener('click', () => modal.classList.remove('active'));
if (closeModal2 && modal) closeModal2.addEventListener('click', () => modal.classList.remove('active'));


const adImages = document.getElementById('adImages');
const adPreviewImg = document.getElementById('adPreviewImg');
const adPreviewBox = document.getElementById('adPreviewBox');

if (adImages && adPreviewImg && adPreviewBox) {
  adImages.addEventListener('change', () => {
    const text = adPreviewBox.querySelector('.ad-preview__text');
    const file = adImages.files && adImages.files[0];

    if (!file) {
      adPreviewImg.style.display = 'none';
      if (text) text.style.display = 'block';
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    adPreviewImg.src = imageUrl;
    adPreviewImg.style.display = 'block';
    if (text) text.style.display = 'none';
  });
}
