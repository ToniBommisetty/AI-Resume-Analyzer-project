let heroIndex = 0;

setInterval(() => {
  const slides = document.querySelectorAll('.hero-slide');
  if (!slides.length) return;

  slides[heroIndex].classList.remove('active');
  heroIndex = (heroIndex + 1) % slides.length;
  slides[heroIndex].classList.add('active');
}, 4000);

const cookiePopup=document.getElementById('cookiePopup');
function acceptCookies(){localStorage.setItem('cookie-choice','accepted');cookiePopup.classList.remove('show')}
function declineCookies(){localStorage.setItem('cookie-choice','declined');cookiePopup.classList.remove('show')}

function openSearchModal(){
  document.getElementById('searchBackdrop').classList.add('show');
  document.getElementById('searchModal').classList.add('show');
  setTimeout(()=>document.getElementById('liveSearchInput').focus(),50);
}
function closeSearchModal(){
  document.getElementById('searchBackdrop').classList.remove('show');
  document.getElementById('searchModal').classList.remove('show');
}
function clearSearch(){
  const input=document.getElementById('liveSearchInput');
  input.value='';
  document.getElementById('liveSearchResults').innerHTML='<p class="muted">Type to search products...</p>';
  input.focus();
}
function quickSearch(term) {
  const input = document.getElementById('liveSearchInput');

  if (!input) return;

  input.value = term;
  input.dispatchEvent(new Event('input'));
}
function toggleMobileMenu(){
  document.getElementById('mobileMenu').classList.toggle('show');
}

async function runLiveSearch(q) {
  const box = document.getElementById('liveSearchResults');

  if (!q.trim()) {
    box.innerHTML = '<p class="muted">Type to search products...</p>';
    return;
  }

  try {
    const res = await fetch('/api/search?q=' + encodeURIComponent(q));
    const items = await res.json();

    if (!items.length) {
      box.innerHTML = '<p class="muted">No products found.</p>';
      return;
    }

    box.innerHTML = items.map(p => `
      <a class="search-result-item" href="/product/${p.slug}">
        <img src="${p.image || '/images/placeholder-product.svg'}" alt="${p.name}">
        <div>
          <h4>${p.name}</h4>
          <p>${p.brand || ''}</p>
          <small>£${Number(p.price).toFixed(2)}</small>
        </div>
      </a>
    `).join('');

  } catch (err) {
    box.innerHTML = '<p class="muted">Search error. Please try again.</p>';
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const cookiePopup = document.getElementById('cookiePopup');

  if (cookiePopup && !localStorage.getItem('cookie-choice')) {
    cookiePopup.classList.add('show');
  }
});

function acceptCookies() {
  localStorage.setItem('cookie-choice', 'accepted');
  document.getElementById('cookiePopup').classList.remove('show');
}

function declineCookies() {
  localStorage.setItem('cookie-choice', 'declined');
  document.getElementById('cookiePopup').classList.remove('show');
}



// LIVE PRODUCT SEARCH FIX
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('liveSearchInput');
  const resultsBox = document.getElementById('liveSearchResults');

  if (!input || !resultsBox) return;

  input.addEventListener('input', async () => {
    const q = input.value.trim();

    if (!q) {
      resultsBox.innerHTML = '<p class="muted">Type to search products...</p>';
      return;
    }

    resultsBox.innerHTML = '<p class="muted">Searching...</p>';

    try {
      const response = await fetch('/api/search?q=' + encodeURIComponent(q));
      const products = await response.json();

      if (!products.length) {
        resultsBox.innerHTML = '<p class="muted">No products found.</p>';
        return;
      }

      resultsBox.innerHTML = products.map(product => `
        <a class="search-result-item" href="/product/${product.slug}">
          <img src="${product.image || '/images/placeholder-product.svg'}" alt="${product.name}">
          <div>
            <h4>${product.name}</h4>
            <p>${product.brand || ''}</p>
            <small>£${Number(product.price || 0).toFixed(2)}</small>
          </div>
        </a>
      `).join('');

    } catch (error) {
      resultsBox.innerHTML = '<p class="muted">Search error. Please restart server.</p>';
    }
  });
});


document.addEventListener('submit', function (e) {
  const form = e.target;

  if (form.action.includes('_method=DELETE')) {
    const ok = confirm('Are you sure you want to delete this item?');
    if (!ok) e.preventDefault();
  }
});


function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
});


let activeSearchIndex = -1;

function saveRecentSearch(term) {
  const searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
  const filtered = searches.filter(s => s !== term);
  filtered.unshift(term);
  localStorage.setItem('recentSearches', JSON.stringify(filtered.slice(0, 5)));
}

function renderRecentSearches() {
  const box = document.getElementById('liveSearchResults');
  if (!box) return;

  const searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');

  if (!searches.length) {
    box.innerHTML = '<p class="muted">Type to search products...</p>';
    return;
  }

  box.innerHTML = `
    <h4 class="recent-title">Recent Searches</h4>
    ${searches.map(s => `
      <button class="recent-search-item" onclick="quickSearch('${s}')">
        🕘 ${s}
      </button>
    `).join('')}
  `;
}

async function runLiveSearch(q) {
  const box = document.getElementById('liveSearchResults');

  if (!box) return;

  if (!q.trim()) {
    renderRecentSearches();
    return;
  }

  box.innerHTML = `
    <div class="search-skeleton"></div>
    <div class="search-skeleton"></div>
    <div class="search-skeleton"></div>
  `;

  const res = await fetch('/api/search?q=' + encodeURIComponent(q));
  const items = await res.json();

  if (!items.length) {
    box.innerHTML = '<p class="muted">No products found.</p>';
    return;
  }

  saveRecentSearch(q);
  activeSearchIndex = -1;

  box.innerHTML = items.map((p, index) => `
    <a class="search-result-item" data-index="${index}" href="/product/${p.slug}">
      <img src="${p.image || '/images/placeholder-product.svg'}" alt="${p.name}">
      <div>
        <h4>${p.name}</h4>
        <p>${p.brand || p.category_name || ''}</p>
        <small>£${Number(p.price || 0).toFixed(2)}</small>
      </div>
    </a>
  `).join('');
}

function quickSearch(term) {
  const input = document.getElementById('liveSearchInput');
  if (!input) return;

  input.value = term;
  runLiveSearch(term);
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('liveSearchInput');

  if (input) {
    renderRecentSearches();

    input.addEventListener('input', () => {
      runLiveSearch(input.value);
    });

    input.addEventListener('keydown', e => {
      const results = document.querySelectorAll('.search-result-item');

      if (!results.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeSearchIndex = Math.min(activeSearchIndex + 1, results.length - 1);
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeSearchIndex = Math.max(activeSearchIndex - 1, 0);
      }

      if (e.key === 'Enter' && activeSearchIndex >= 0) {
        e.preventDefault();
        window.location.href = results[activeSearchIndex].href;
      }

      results.forEach(r => r.classList.remove('active'));
      if (results[activeSearchIndex]) {
        results[activeSearchIndex].classList.add('active');
      }
    });
  }
});




document.addEventListener('click', e => {
  const link = e.target.closest('a');

  if (
  link &&
  link.href &&
  !link.href.includes('#') &&
  !link.target &&
  !link.href.includes('/invoice/')
) {
  document.body.classList.add('page-loading');
}
});

window.addEventListener('load', () => {
  document.body.classList.remove('page-loading');
});


function toggleMobileMenu() {
  document.getElementById('mobileSideMenu')?.classList.toggle('active');
  document.getElementById('mobileMenuOverlay')?.classList.toggle('active');
}


function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

document.addEventListener('submit', e => {
  const form = e.target;

  if (form.action.includes('/cart/add')) {
    showToast('Product added to basket');
  }

  if (form.action.includes('/checkout')) {
    showToast('Placing your order...');
  }
});


document.addEventListener('click', function (e) {
  const invoiceLink = e.target.closest('a[href^="/invoice/"]');

  if (invoiceLink) {
    document.body.classList.remove('page-loading');
  }
});