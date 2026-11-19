const password = document.querySelector('#password');
const toggle = document.querySelector('#toggle-password');
const starterPhotos = [
  { title: 'ภูเขาในยามเช้า', description: 'แสงแรกของวันค่อย ๆ แตะยอดเขา ท่ามกลางหมอกบางและธรรมชาติที่เงียบสงบ', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=85' },
  { title: 'ทะเลสาบกลางหุบเขา', description: 'ผืนน้ำสีฟ้าสะท้อนแนวภูเขา เป็นภาพบรรยากาศที่ชวนให้หยุดพักและผ่อนคลาย', url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=85' },
  { title: 'ป่าสนและสายหมอก', description: 'ป่าสีเขียวทอดยาวผ่านหุบเขา พร้อมหมอกที่ปกคลุมยอดไม้ในวันที่อากาศเย็น', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=85' },
  { title: 'พระอาทิตย์ตกริมทะเล', description: 'ท้องฟ้าสีอบอุ่นและคลื่นทะเลเบา ๆ ส่งท้ายวันอย่างเรียบง่าย', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85' }
];

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

let photos = readStorage('gallery-photos', starterPhotos);
if (!Array.isArray(photos)) photos = starterPhotos;
let videos = readStorage('gallery-videos', []);
if (!Array.isArray(videos)) videos = [];

const loginPage = document.querySelector('#login-page');
const adminLoginPage = document.querySelector('#admin-login-page');
const homePage = document.querySelector('#home-page');
const adminPage = document.querySelector('#admin-page');
const contactPage = document.querySelector('#contact-page');
const heroImage = document.querySelector('#hero-image');
const thumbs = document.querySelector('#thumbs');
const contactDefaults = { address: '', phone: '', email: '', line: '', facebook: '', other: '' };
let contactInfo = { ...contactDefaults, ...readStorage('contact-info', {}) };

function renderContact() {
  const items = [
    ['ที่อยู่', contactInfo.address], ['เบอร์โทร', contactInfo.phone], ['อีเมล', contactInfo.email],
    ['LINE ID', contactInfo.line], ['Facebook', contactInfo.facebook], ['ช่องทางอื่น ๆ', contactInfo.other]
  ].filter(([, value]) => value && value.trim());
  const container = document.querySelector('#contact-details');
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.textContent = 'ยังไม่มีข้อมูลติดต่อ';
    container.append(empty);
    return;
  }
  items.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'contact-row';
    const heading = document.createElement('strong');
    heading.textContent = label;
    const content = document.createElement('div');
    content.textContent = value;
    content.style.whiteSpace = 'pre-wrap';
    row.append(heading, content);
    container.append(row);
  });
}

function fillContactForm() {
  document.querySelector('#contact-address').value = contactInfo.address;
  document.querySelector('#contact-phone').value = contactInfo.phone;
  document.querySelector('#contact-email').value = contactInfo.email;
  document.querySelector('#contact-line').value = contactInfo.line;
  document.querySelector('#contact-facebook').value = contactInfo.facebook;
  document.querySelector('#contact-other').value = contactInfo.other;
}

function persistPhotos() {
  try {
    localStorage.setItem('gallery-photos', JSON.stringify(photos));
    return true;
  } catch {
    document.querySelector('#admin-message').textContent = 'พื้นที่จัดเก็บไม่พอ กรุณาใช้รูปภาพขนาดเล็กลง';
    return false;
  }
}

function persistVideos() {
  try {
    localStorage.setItem('gallery-videos', JSON.stringify(videos));
    return true;
  } catch {
    document.querySelector('#video-admin-message').textContent = 'พื้นที่จัดเก็บไม่พอ กรุณาใช้ไฟล์วิดีโอขนาดเล็กลง';
    return false;
  }
}

function selectPhoto(index) {
  const photo = photos[index];
  if (!photo) return;
  heroImage.src = photo.url;
  heroImage.alt = photo.title;
  document.querySelector('#photo-title').textContent = photo.title;
  document.querySelector('#photo-description').textContent = photo.description;
  document.querySelectorAll('.thumb').forEach((button, buttonIndex) => {
    button.setAttribute('aria-pressed', String(buttonIndex === index));
  });
}

function renderGallery() {
  thumbs.replaceChildren();
  photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.className = 'thumb';
    button.type = 'button';
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
  if (photos.length) selectPhoto(0);
  else {
    heroImage.removeAttribute('src');
    heroImage.alt = 'ยังไม่มีรูปภาพ';
    document.querySelector('#photo-title').textContent = 'ยังไม่มีรูปภาพ';
    document.querySelector('#photo-description').textContent = 'ผู้ดูแลระบบสามารถเพิ่มรูปได้จากหน้า Admin';
  }
}

function renderVideos() {
  const homeList = document.querySelector('#home-video-list');
  const adminList = document.querySelector('#video-admin-list');
  homeList.replaceChildren();
  adminList.replaceChildren();
  videos.forEach((video, index) => {
    const homeItem = document.createElement('article');
    homeItem.className = 'video-item';
    const preview = document.createElement('video');
    preview.src = video.url;
    preview.preload = 'metadata';
    preview.autoplay = true;
    preview.muted = true;
    preview.loop = true;
    preview.playsInline = true;
    preview.controls = true;
    homeItem.append(preview);
    homeList.append(homeItem);

    const adminItem = document.createElement('article');
    adminItem.className = 'video-item';
    const adminPreview = document.createElement('video');
    adminPreview.src = video.url;
    adminPreview.preload = 'metadata';
    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    const edit = document.createElement('button');
    edit.className = 'secondary';
    edit.type = 'button';
    edit.textContent = 'แก้ไข';
    edit.addEventListener('click', () => {
      document.querySelector('#edit-video-index').value = String(index);
      document.querySelector('#cancel-video-edit').hidden = false;
      document.querySelector('#video-form').scrollIntoView({ behavior: 'smooth' });
    });
    const remove = document.createElement('button');
    remove.className = 'secondary danger';
    remove.type = 'button';
    remove.textContent = 'ลบ';
    remove.addEventListener('click', () => {
      videos.splice(index, 1);
      if (persistVideos()) renderVideos();
    });
    actions.append(edit, remove);
    adminItem.append(adminPreview, actions);
    adminList.append(adminItem);
  });
}

function renderAdminList() {
  const list = document.querySelector('#admin-list');
  list.replaceChildren();
  photos.forEach((photo, index) => {
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
    edit.className = 'secondary';
    edit.type = 'button';
    edit.textContent = 'แก้ไข';
    edit.addEventListener('click', () => {
      document.querySelector('#edit-index').value = String(index);
      document.querySelector('#photo-name').value = photo.title;
      document.querySelector('#photo-detail').value = photo.description;
      document.querySelector('#cancel-edit').hidden = false;
      document.querySelector('#photo-form').scrollIntoView({ behavior: 'smooth' });
    });
    const remove = document.createElement('button');
    remove.className = 'secondary danger';
    remove.type = 'button';
    remove.textContent = 'ลบ';
    remove.addEventListener('click', () => {
      photos.splice(index, 1);
      if (persistPhotos()) {
        renderAdminList();
        renderGallery();
      }
    });
    actions.append(edit, remove);
    item.append(image, details, actions);
    list.append(item);
  });
}

toggle.addEventListener('click', () => {
  const showing = password.type === 'password';
  password.type = showing ? 'text' : 'password';
  toggle.textContent = showing ? 'ซ่อน' : 'แสดง';
  toggle.setAttribute('aria-label', showing ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
});

document.querySelector('#open-admin-login').addEventListener('click', () => {
  homePage.hidden = true;
  adminLoginPage.hidden = false;
  document.title = 'เข้าสู่ระบบ Admin';
  window.scrollTo(0, 0);
});

document.querySelector('#admin-login-back').addEventListener('click', () => {
  adminLoginPage.hidden = true;
  homePage.hidden = false;
  document.title = 'Home';
});

document.querySelector('#admin-login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.querySelector('#admin-name').value.trim().toLowerCase();
  const adminPassword = document.querySelector('#admin-password').value;
  if (name !== 'admin' || adminPassword !== 'adminadmin') {
    document.querySelector('#admin-login-message').textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    return;
  }
  adminLoginPage.hidden = true;
  adminPage.hidden = false;
  document.title = 'Admin';
  renderAdminList();
  renderVideos();
  window.scrollTo(0, 0);
});

document.querySelector('#contact-link').addEventListener('click', (event) => {
  event.preventDefault();
  homePage.hidden = true;
  contactPage.hidden = false;
  renderContact();
  document.title = 'ติดต่อสอบถาม';
  window.scrollTo(0, 0);
});

document.querySelector('#contact-back').addEventListener('click', () => {
  contactPage.hidden = true;
  homePage.hidden = false;
  document.title = 'Home';
  window.scrollTo(0, 0);
});

document.querySelector('#contact-form').addEventListener('submit', (event) => {
  event.preventDefault();
  contactInfo = {
    address: document.querySelector('#contact-address').value.trim(),
    phone: document.querySelector('#contact-phone').value.trim(),
    email: document.querySelector('#contact-email').value.trim(),
    line: document.querySelector('#contact-line').value.trim(),
    facebook: document.querySelector('#contact-facebook').value.trim(),
    other: document.querySelector('#contact-other').value.trim()
  };
  try {
    localStorage.setItem('contact-info', JSON.stringify(contactInfo));
    document.querySelector('#contact-admin-message').textContent = 'บันทึกข้อมูลติดต่อแล้ว';
    renderContact();
  } catch {
    document.querySelector('#contact-admin-message').textContent = 'บันทึกไม่สำเร็จ พื้นที่จัดเก็บอาจไม่เพียงพอ';
  }
});

document.querySelector('#photo-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const file = document.querySelector('#photo-file').files[0];
  const editIndex = document.querySelector('#edit-index').value;
  const existing = editIndex === '' ? null : photos[Number(editIndex)];
  if (!existing && !file) {
    document.querySelector('#admin-message').textContent = 'กรุณาเลือกรูปภาพ';
    return;
  }
  const savePhoto = (url) => {
    const photo = { title: document.querySelector('#photo-name').value.trim(), description: document.querySelector('#photo-detail').value.trim(), url };
    if (existing) photos[Number(editIndex)] = photo;
    else photos.push(photo);
    if (!persistPhotos()) return;
    document.querySelector('#photo-form').reset();
    document.querySelector('#edit-index').value = '';
    document.querySelector('#cancel-edit').hidden = true;
    document.querySelector('#admin-message').textContent = 'บันทึกรูปภาพแล้ว';
    renderAdminList();
    renderGallery();
  };
  if (file) {
    const reader = new FileReader();
    reader.addEventListener('load', () => savePhoto(reader.result));
    reader.addEventListener('error', () => { document.querySelector('#admin-message').textContent = 'อ่านไฟล์รูปภาพไม่สำเร็จ'; });
    reader.readAsDataURL(file);
  } else savePhoto(existing.url);
});

document.querySelector('#cancel-edit').addEventListener('click', () => {
  document.querySelector('#photo-form').reset();
  document.querySelector('#edit-index').value = '';
  document.querySelector('#cancel-edit').hidden = true;
  document.querySelector('#admin-message').textContent = '';
});

document.querySelector('#video-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const file = document.querySelector('#video-file').files[0];
  const editIndex = document.querySelector('#edit-video-index').value;
  const existing = editIndex === '' ? null : videos[Number(editIndex)];
  if (file && file.size > 5 * 1024 * 1024) {
    document.querySelector('#video-admin-message').textContent = 'ไฟล์วิดีโอต้องมีขนาดไม่เกิน 5 MB';
    return;
  }
  if (!existing && !file) {
    document.querySelector('#video-admin-message').textContent = 'กรุณาเลือกไฟล์วิดีโอ';
    return;
  }
  const saveVideo = (url) => {
    const video = { title: file ? file.name : existing.title, description: existing ? existing.description || '' : '', url };
    if (existing) videos[Number(editIndex)] = video;
    else videos.push(video);
    if (!persistVideos()) return;
    document.querySelector('#video-form').reset();
    document.querySelector('#edit-video-index').value = '';
    document.querySelector('#cancel-video-edit').hidden = true;
    document.querySelector('#video-admin-message').textContent = 'บันทึกวิดีโอแล้ว';
    renderVideos();
  };
  if (file) {
    const reader = new FileReader();
    reader.addEventListener('load', () => saveVideo(reader.result));
    reader.addEventListener('error', () => { document.querySelector('#video-admin-message').textContent = 'อ่านไฟล์วิดีโอไม่สำเร็จ'; });
    reader.readAsDataURL(file);
  } else saveVideo(existing.url);
});

document.querySelector('#cancel-video-edit').addEventListener('click', () => {
  document.querySelector('#video-form').reset();
  document.querySelector('#edit-video-index').value = '';
  document.querySelector('#cancel-video-edit').hidden = true;
  document.querySelector('#video-admin-message').textContent = '';
});

document.querySelector('#admin-logout').addEventListener('click', () => {
  adminPage.hidden = true;
  homePage.hidden = false;
  document.querySelector('#admin-login-form').reset();
  document.title = 'Home';
  window.scrollTo(0, 0);
});

renderContact();
fillContactForm();
renderGallery();
renderVideos();
renderAdminList();
homePage.hidden = false;
