const $ = (selector) => document.querySelector(selector);
const state = { photos: [], videos: [], products: [], contact: {}, header: { imageData: '', heightPx: 400, zoomPercent: 100, positionX: 50, positionY: 50 } };
let homeVideoIndex = 0;

async function api(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const retryable = ['GET', 'HEAD', 'PUT', 'DELETE'].includes(method) || url === '/api/admin/login';
  const attempts = retryable ? 3 : 1;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        credentials: 'same-origin', ...options,
        headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
      });
      if (response.status === 204) return null;
      const result = await response.json().catch(() => ({}));
      if (response.ok) return result;
      lastError = new Error(result.error || `Request failed (${response.status})`);
      if (!retryable || response.status < 500 || attempt === attempts - 1) throw lastError;
    } catch (error) {
      lastError = error;
      if (!retryable || attempt === attempts - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  throw lastError || new Error('Request failed');
}

function message(selector, text) { $(selector).textContent = text; }

function renderSiteHeader() {
  const header = state.header || { imageData: '', heightPx: 400, zoomPercent: 100, positionX: 50, positionY: 50 };
  const height = Math.min(480, Math.max(220, Number(header.heightPx) || 400));
  const zoom = Math.min(180, Math.max(100, Number(header.zoomPercent) || 100));
  const positionX = Math.min(100, Math.max(0, Number(header.positionX ?? 50)));
  const positionY = Math.min(100, Math.max(0, Number(header.positionY ?? 50)));
  $('#site-hero').style.setProperty('--hero-height', `${height}px`);
  $('#header-height').value = String(height);
  $('#header-zoom').value = String(zoom);
  $('#header-zoom-value').textContent = `${zoom}%`;
  for (const image of [$('#site-hero-image'), $('#header-preview-image')]) {
    image.style.transform = `scale(${zoom / 100})`;
    image.style.objectPosition = `${positionX}% ${positionY}%`;
    if (header.imageData) {
      image.src = header.imageData;
      image.hidden = false;
    } else {
      image.removeAttribute('src');
      image.hidden = true;
    }
  }
}

function renderContact() {
  const labels = [['ที่อยู่', 'address'], ['เบอร์โทร', 'phone'], ['อีเมล', 'email'], ['LINE ID', 'line'], ['Facebook', 'facebook'], ['ช่องทางอื่น ๆ', 'other']];
  const container = $('#contact-details');
  container.replaceChildren();
  const items = labels.filter(([, key]) => String(state.contact[key] || '').trim());
  if (!items.length) {
    const empty = document.createElement('p');
    empty.textContent = 'ยังไม่มีข้อมูลติดต่อ';
    container.append(empty);
    return;
  }
  for (const [label, key] of items) {
    const row = document.createElement('div');
    row.className = 'contact-row';
    const heading = document.createElement('strong');
    heading.textContent = label;
    const value = document.createElement('div');
    value.textContent = state.contact[key];
    value.style.whiteSpace = 'pre-wrap';
    row.append(heading, value);
    container.append(row);
  }
}

function formatPrice(value) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function renderProducts() {
  const grid = $('#product-grid');
  grid.replaceChildren();
  if (!state.products.length) {
    const empty = document.createElement('p');
    empty.textContent = 'ยังไม่มีสินค้า';
    grid.append(empty);
  }
  for (const product of state.products) {
    const card = document.createElement('article');
    card.className = 'product-card';
    const image = document.createElement('img');
    image.src = product.imageData;
    image.alt = product.name;
    image.loading = 'lazy';
    image.addEventListener('click', () => {
      $('#product-image-full').src = product.imageData;
      $('#product-image-full').alt = product.name;
      $('#product-image-dialog').showModal();
    });
    const body = document.createElement('div');
    body.className = 'product-card-body';
    const name = document.createElement('h2');
    name.textContent = product.name;
    const prices = document.createElement('div');
    prices.className = 'product-prices';
    if (product.promoPrice !== null && product.promoPrice !== undefined && product.promoPrice !== '') {
      const original = document.createElement('span');
      original.className = 'product-price-old';
      original.textContent = `${formatPrice(product.price)} บาท`;
      const promo = document.createElement('strong');
      promo.className = 'product-price';
      promo.textContent = `${formatPrice(product.promoPrice)} บาท`;
      prices.append(original, promo);
    } else {
      const price = document.createElement('strong');
      price.className = 'product-price';
      price.textContent = `${formatPrice(product.price)} บาท`;
      prices.append(price);
    }
    const note = document.createElement('p');
    note.className = 'product-note';
    note.textContent = product.note || '';
    body.append(name, prices, note);
    card.append(image, body);
    grid.append(card);
  }
  renderAdminProducts();
}

$('#product-image-close').addEventListener('click', () => $('#product-image-dialog').close());
$('#product-image-dialog').addEventListener('click', (event) => {
  if (event.target === $('#product-image-dialog')) $('#product-image-dialog').close();
});

function renderAdminProducts() {
  const list = $('#product-admin-list');
  if (!list) return;
  list.replaceChildren();
  for (const product of state.products) {
    const item = document.createElement('article');
    item.className = 'admin-item product-admin-item';
    const image = document.createElement('img');
    image.src = product.imageData;
    image.alt = '';
    const details = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = product.name;
    const pricing = document.createElement('p');
    pricing.textContent = `ราคา ${formatPrice(product.price)} บาท${product.promoPrice != null ? ` · โปร ${formatPrice(product.promoPrice)} บาท` : ''}${product.note ? ` · ${product.note}` : ''}`;
    details.append(name, pricing);
    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary';
    edit.textContent = 'แก้ไข';
    edit.addEventListener('click', () => {
      $('#edit-product-id').value = product.id;
      $('#product-name').value = product.name;
      $('#product-price').value = product.price;
      $('#product-promo-price').value = product.promoPrice ?? '';
      $('#product-note').value = product.note || '';
      $('#cancel-product-edit').hidden = false;
      $('#product-form').scrollIntoView({ behavior: 'smooth' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary danger';
    remove.textContent = 'ลบ';
    remove.addEventListener('click', async () => {
      try {
        await api(`/api/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
        await loadData();
        message('#product-admin-message', 'ลบสินค้าแล้ว');
      } catch (error) { message('#product-admin-message', error.message); }
    });
    actions.append(edit, remove);
    item.append(image, details, actions);
    list.append(item);
  }
}

function renderGallery() {
  const thumbs = $('#thumbs');
  thumbs.replaceChildren();
  state.photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.setAttribute('aria-label', `ดูรูป ${photo.title}`);
    button.setAttribute('aria-pressed', 'false');
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = '';
    image.loading = 'lazy';
    button.append(image);
    button.addEventListener('click', () => selectPhoto(index));
    thumbs.append(button);
  });
  if (state.photos.length) selectPhoto(0);
  else {
    $('#hero-image').removeAttribute('src');
    $('#hero-image').alt = 'ยังไม่มีรูปภาพ';
    $('#photo-title').textContent = 'ยังไม่มีรูปภาพ';
    $('#photo-description').textContent = 'ผู้ดูแลระบบเพิ่มรูปภาพได้จากหน้า Admin';
  }
}

function selectPhoto(index) {
  const photo = state.photos[index];
  if (!photo) return;
  $('#hero-image').src = photo.url;
  $('#hero-image').alt = photo.title;
  $('#photo-title').textContent = photo.title;
  $('#photo-description').textContent = photo.description;
  document.querySelectorAll('.thumb').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
}

function renderAdminPhotos() {
  const list = $('#admin-list');
  list.replaceChildren();
  state.photos.forEach((photo) => {
    const item = document.createElement('article');
    item.className = 'admin-item';
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = '';
    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = photo.title;
    const description = document.createElement('p');
    description.textContent = photo.description;
    details.append(title, description);
    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary';
    edit.textContent = 'แก้ไข';
    edit.addEventListener('click', () => {
      $('#edit-index').value = photo.id;
      $('#photo-name').value = photo.title;
      $('#photo-detail').value = photo.description;
      $('#cancel-edit').hidden = false;
      $('#photo-form').scrollIntoView({ behavior: 'smooth' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary danger';
    remove.textContent = 'ลบ';
    remove.addEventListener('click', async () => {
      try {
        await api(`/api/photos/${encodeURIComponent(photo.id)}`, { method: 'DELETE' });
        await loadData();
        message('#admin-message', 'ลบรูปภาพแล้ว');
      } catch (error) { message('#admin-message', error.message); }
    });
    actions.append(edit, remove);
    item.append(image, details, actions);
    list.append(item);
  });
}

const photoAdminSection = $('#admin-list').closest('section');
photoAdminSection.querySelector('h2').textContent = 'จัดการรูปภาพ';
photoAdminSection.insertBefore($('#photo-form'), $('#admin-list'));

function renderVideos() {
  const homeList = $('#home-video-list');
  const adminList = $('#video-admin-list');
  homeList.replaceChildren();
  adminList.replaceChildren();
  homeVideoIndex = 0;
  state.videos.forEach((video) => {
    const homeItem = document.createElement('article');
    homeItem.className = 'video-item';
    const player = document.createElement('video');
    player.src = video.url;
    player.preload = 'metadata';
    player.controls = true;
    player.autoplay = true;
    player.muted = true;
    player.playsInline = true;
    if (state.videos.length === 1) player.loop = true;
    else player.addEventListener('ended', () => showHomeVideo((homeVideoIndex + 1) % state.videos.length));
    homeItem.append(player);
    homeList.append(homeItem);

    const adminItem = document.createElement('article');
    adminItem.className = 'video-item';
    const preview = document.createElement('video');
    preview.src = video.url;
    preview.preload = 'metadata';
    const title = document.createElement('span');
    title.textContent = video.title;
    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary';
    edit.textContent = 'แก้ไข';
    edit.addEventListener('click', () => {
      $('#edit-video-index').value = video.id;
      $('#cancel-video-edit').hidden = false;
      $('#video-form').scrollIntoView({ behavior: 'smooth' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary danger';
    remove.textContent = 'ลบ';
    remove.addEventListener('click', async () => {
      try {
        await api(`/api/videos/${encodeURIComponent(video.id)}`, { method: 'DELETE' });
        await loadData();
        message('#video-admin-message', 'ลบวิดีโอแล้ว');
      } catch (error) { message('#video-admin-message', error.message); }
    });
    actions.append(edit, remove);
    adminItem.append(preview, title, actions);
    adminList.append(adminItem);
  });
  if (state.videos.length) showHomeVideo(0);
}

function showHomeVideo(index) {
  const homeList = $('#home-video-list');
  const items = [...homeList.children];
  if (!items.length) return;
  homeVideoIndex = index;
  items.forEach((item) => {
    item.style.transform = `translateX(-${index * 100}%)`;
    const player = item.querySelector('video');
    if (player !== items[index].querySelector('video')) player.pause();
  });
  const activePlayer = items[index].querySelector('video');
  activePlayer.play().catch(() => {});
}

async function loadData() {
  const data = await api('/api/home-data');
  state.photos = data.photos || [];
  state.videos = data.videos || [];
  state.products = data.products || [];
  state.contact = data.contact || {};
  state.header = data.header || { imageData: '', heightPx: 400, zoomPercent: 100, positionX: 50, positionY: 50 };
  renderSiteHeader();
  renderGallery();
  renderVideos();
  renderContact();
  renderProducts();
  renderAdminPhotos();
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(new Error('อ่านไฟล์ไม่สำเร็จ')));
    reader.readAsDataURL(file);
  });
}

$('#header-zoom').addEventListener('input', () => {
  const zoom = Number($('#header-zoom').value);
  $('#header-zoom-value').textContent = `${zoom}%`;
  const transform = `scale(${zoom / 100})`;
  $('#site-hero-image').style.transform = transform;
  $('#header-preview-image').style.transform = transform;
});

const headerPreview = $('#header-preview');
let headerDrag = null;
headerPreview.addEventListener('pointerdown', (event) => {
  if ($('#header-preview-image').hidden) return;
  headerDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  headerPreview.setPointerCapture(event.pointerId);
  headerPreview.classList.add('is-dragging');
  event.preventDefault();
});
headerPreview.addEventListener('pointermove', (event) => {
  if (!headerDrag || headerDrag.pointerId !== event.pointerId) return;
  const bounds = headerPreview.getBoundingClientRect();
  const zoom = Number($('#header-zoom').value) / 100;
  const deltaX = (event.clientX - headerDrag.x) / Math.max(1, bounds.width) * 100 / zoom;
  const deltaY = (event.clientY - headerDrag.y) / Math.max(1, bounds.height) * 100 / zoom;
  state.header.positionX = Math.min(100, Math.max(0, Number(state.header.positionX ?? 50) - deltaX));
  state.header.positionY = Math.min(100, Math.max(0, Number(state.header.positionY ?? 50) - deltaY));
  headerDrag.x = event.clientX;
  headerDrag.y = event.clientY;
  for (const image of [$('#site-hero-image'), $('#header-preview-image')]) {
    image.style.objectPosition = `${state.header.positionX}% ${state.header.positionY}%`;
  }
});
function stopHeaderDrag(event) {
  if (!headerDrag || headerDrag.pointerId !== event.pointerId) return;
  headerDrag = null;
  headerPreview.classList.remove('is-dragging');
}
headerPreview.addEventListener('pointerup', stopHeaderDrag);
headerPreview.addEventListener('pointercancel', stopHeaderDrag);

$('#header-file').addEventListener('change', async () => {
  const file = $('#header-file').files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    $('#header-file').value = '';
    return message('#header-admin-message', 'รูปหัวเว็บต้องมีขนาดไม่เกิน 8 MB');
  }
  try {
    $('#header-preview-image').src = await readFile(file);
    $('#header-preview-image').hidden = false;
    message('#header-admin-message', 'ตัวอย่างรูปใหม่ — กดบันทึกเพื่อใช้บนหน้า Home');
  } catch (error) { message('#header-admin-message', error.message); }
});

$('#header-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = $('#header-file').files[0];
  const heightPx = Number($('#header-height').value);
  if (!Number.isInteger(heightPx) || heightPx < 220 || heightPx > 480) {
    return message('#header-admin-message', 'กำหนดความสูงได้ตั้งแต่ 220 ถึง 480 px');
  }
  if (file && file.size > 8 * 1024 * 1024) {
    return message('#header-admin-message', 'รูปหัวเว็บต้องมีขนาดไม่เกิน 8 MB');
  }
  try {
    const imageData = file ? await readFile(file) : state.header.imageData || '';
    const zoomPercent = Number($('#header-zoom').value);
    state.header = await api('/api/header', {
      method: 'PUT',
      body: JSON.stringify({ imageData, heightPx, zoomPercent, positionX: state.header.positionX ?? 50, positionY: state.header.positionY ?? 50 })
    });
    $('#header-file').value = '';
    renderSiteHeader();
    message('#header-admin-message', 'บันทึกภาพหัว Home ลง MongoDB แล้ว');
  } catch (error) { message('#header-admin-message', error.message); }
});

$('#toggle-password').addEventListener('click', () => {
  const field = $('#password');
  field.type = field.type === 'password' ? 'text' : 'password';
});
api('/api/admin/config').then((config) => {
  if (!config.authRequired) {
    $('#admin-login-form').noValidate = true;
    $('#admin-name').closest('.field').hidden = true;
    $('#admin-password').closest('.field').hidden = true;
    $('#admin-login-page .intro').textContent = 'โหมดใช้งานเฉพาะเครื่องนี้ ไม่ต้องใช้รหัสผ่าน';
  }
}).catch(() => {});
$('#open-admin-login').addEventListener('click', () => {
  $('#home-page').hidden = true;
  $('#admin-login-page').hidden = false;
  window.scrollTo(0, 0);
});
$('#admin-login-back').addEventListener('click', () => {
  $('#admin-login-page').hidden = true;
  $('#home-page').hidden = false;
});

$('#admin-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  message('#admin-login-message', 'กำลังเข้าสู่ระบบ…');
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: $('#admin-name').value.trim(), password: $('#admin-password').value }) });
    $('#admin-login-page').hidden = true;
    $('#admin-page').hidden = false;
    fillContactForm();
    window.scrollTo(0, 0);
    try {
      await loadData();
    } catch (error) {
      message('#admin-message', `เข้า Admin ได้แล้ว แต่ฐานข้อมูลยังไม่พร้อม: ${error.message}`);
    }
  } catch (error) { message('#admin-login-message', error.message); }
});

const productsNav = document.createElement('button');
productsNav.className = 'contact-link';
productsNav.id = 'open-products';
productsNav.type = 'button';
productsNav.textContent = 'สินค้า';
$('#contact-link').before(productsNav);
productsNav.addEventListener('click', () => {
  $('#home-page').hidden = true;
  $('#products-page').hidden = false;
  renderProducts();
  window.scrollTo(0, 0);
});
$('#products-back').addEventListener('click', () => {
  $('#products-page').hidden = true;
  $('#home-page').hidden = false;
  window.scrollTo(0, 0);
});

$('#contact-link').addEventListener('click', (event) => {
  event.preventDefault();
  $('#home-page').hidden = true;
  $('#contact-page').hidden = false;
  renderContact();
  window.scrollTo(0, 0);
});
$('#contact-back').addEventListener('click', () => {
  $('#contact-page').hidden = true;
  $('#home-page').hidden = false;
  window.scrollTo(0, 0);
});

$('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#edit-product-id').value;
  const existing = state.products.find((product) => product.id === id);
  const file = $('#product-image').files[0];
  const price = Number($('#product-price').value);
  const promoRaw = $('#product-promo-price').value.trim();
  const promoPrice = promoRaw === '' ? null : Number(promoRaw);
  if (!existing && !file) return message('#product-admin-message', 'กรุณาเลือกรูปสินค้า');
  if (file && file.size > 8 * 1024 * 1024) return message('#product-admin-message', 'รูปสินค้าต้องมีขนาดไม่เกิน 8 MB');
  if (!Number.isFinite(price) || price < 0 || (promoPrice !== null && (!Number.isFinite(promoPrice) || promoPrice < 0))) {
    return message('#product-admin-message', 'กรุณากรอกราคาให้ถูกต้อง');
  }
  try {
    const payload = {
      name: $('#product-name').value.trim(), price, promoPrice,
      note: $('#product-note').value.trim(),
      imageData: file ? await readFile(file) : existing.imageData
    };
    await api(existing ? `/api/products/${encodeURIComponent(id)}` : '/api/products', {
      method: existing ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    $('#product-form').reset();
    $('#edit-product-id').value = '';
    $('#cancel-product-edit').hidden = true;
    await loadData();
    message('#product-admin-message', 'บันทึกสินค้าใน MongoDB แล้ว');
  } catch (error) { message('#product-admin-message', error.message); }
});

$('#cancel-product-edit').addEventListener('click', () => {
  $('#product-form').reset();
  $('#edit-product-id').value = '';
  $('#cancel-product-edit').hidden = true;
  message('#product-admin-message', '');
});

$('#contact-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = ['address', 'phone', 'email', 'line', 'facebook', 'other'];
  const contact = Object.fromEntries(fields.map((key) => [key, $(`#contact-${key}`).value.trim()]));
  try {
    state.contact = await api('/api/contact', { method: 'PUT', body: JSON.stringify(contact) });
    renderContact();
    message('#contact-admin-message', 'บันทึกข้อมูลติดต่อแล้ว');
  } catch (error) { message('#contact-admin-message', error.message); }
});

$('#photo-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const editId = $('#edit-index').value;
  const existing = state.photos.find((photo) => photo.id === editId);
  const file = $('#photo-file').files[0];
  if (!existing && !file) return message('#admin-message', 'กรุณาเลือกรูปภาพ');
  if (file && file.size > 8 * 1024 * 1024) return message('#admin-message', 'รูปภาพต้องมีขนาดไม่เกิน 8 MB');
  try {
    const payload = { title: $('#photo-name').value.trim(), description: $('#photo-detail').value.trim(), url: file ? await readFile(file) : existing.url };
    await api(existing ? `/api/photos/${encodeURIComponent(existing.id)}` : '/api/photos', { method: existing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    $('#photo-form').reset();
    $('#edit-index').value = '';
    $('#cancel-edit').hidden = true;
    await loadData();
    message('#admin-message', 'บันทึกรูปภาพลง MongoDB แล้ว');
  } catch (error) { message('#admin-message', error.message); }
});
$('#cancel-edit').addEventListener('click', () => {
  $('#photo-form').reset();
  $('#edit-index').value = '';
  $('#cancel-edit').hidden = true;
  message('#admin-message', '');
});

$('#video-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const editId = $('#edit-video-index').value;
  const existing = state.videos.find((video) => video.id === editId);
  const file = $('#video-file').files[0];
  if (!existing && !file) return message('#video-admin-message', 'กรุณาเลือกไฟล์วิดีโอ');
  if (file && file.size > 5 * 1024 * 1024) return message('#video-admin-message', 'วิดีโอต้องมีขนาดไม่เกิน 5 MB');
  try {
    const payload = { title: file ? file.name : existing.title, url: file ? await readFile(file) : existing.url };
    await api(existing ? `/api/videos/${encodeURIComponent(existing.id)}` : '/api/videos', { method: existing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    $('#video-form').reset();
    $('#edit-video-index').value = '';
    $('#cancel-video-edit').hidden = true;
    await loadData();
    message('#video-admin-message', 'บันทึกวิดีโอลง MongoDB แล้ว');
  } catch (error) { message('#video-admin-message', error.message); }
});
$('#cancel-video-edit').addEventListener('click', () => {
  $('#video-form').reset();
  $('#edit-video-index').value = '';
  $('#cancel-video-edit').hidden = true;
  message('#video-admin-message', '');
});

$('#admin-logout').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* The session may have expired. */ }
  $('#admin-page').hidden = true;
  $('#home-page').hidden = false;
  $('#admin-login-form').reset();
  window.scrollTo(0, 0);
});

$('#home-page').hidden = false;
loadData().catch((error) => {
  $('#photo-title').textContent = 'โหลดข้อมูลไม่สำเร็จ';
  $('#photo-description').textContent = error.message;
});
