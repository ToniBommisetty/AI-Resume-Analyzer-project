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