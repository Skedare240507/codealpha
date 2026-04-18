let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let selectedProduct = null;
let user = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    checkUser();
    updateCartUI();

    // Event Listeners for Search and Filter
    document.getElementById('search-input').addEventListener('input', filterProducts);
    document.getElementById('category-filter').addEventListener('change', filterProducts);
});

function filterProducts() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm) || 
                             p.description.toLowerCase().includes(searchTerm);
        const matchesCategory = category === 'all' || p.category === category;
        return matchesSearch && matchesCategory;
    });

    renderProducts(filtered);
}

// Auth check
async function checkUser() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            user = await res.json();
            document.getElementById('auth-links').innerHTML = `
                <a onclick="showOrders()" style="cursor: pointer; opacity: 0.8;">My Orders</a>
                <span style="color: var(--text-muted); font-size: 0.9rem;">Hi, ${user.username}</span>
                <a onclick="logout()" style="color: var(--primary); cursor: pointer; font-weight: 600;">Logout</a>
            `;
        }
    } catch (err) {
        console.log('Not logged in');
    }
}

async function showOrders() {
    const res = await fetch('/api/my-orders');
    const orders = await res.json();
    
    const list = document.getElementById('orders-list');
    if (orders.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No orders found.</p>';
    } else {
        list.innerHTML = orders.map(order => `
            <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 16px; margin-bottom: 1.5rem; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                    <strong>Order #${order.id}</strong>
                    <span style="color: var(--primary); font-weight: 700;">$${order.total_price.toFixed(2)}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
                    Date: ${new Date(order.created_at).toLocaleDateString()} | Status: ${order.status.toUpperCase()}
                </div>
                <div style="border-top: 1px solid var(--border); padding-top: 1rem;">
                    ${order.items.map(item => `
                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.5rem;">
                            <span>${item.name} x ${item.quantity}</span>
                            <span>$${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
    
    document.getElementById('orders-modal').style.display = 'flex';
}

function closeOrdersModal() {
    document.getElementById('orders-modal').style.display = 'none';
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
}

// Product logic
async function fetchProducts() {
    const res = await fetch('/api/products');
    products = await res.json();
    renderProducts(products);
}

function renderProducts(items) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = items.map(item => `
        <div class="product-card" onclick="openModal(${item.id})">
            <div class="product-image-container">
                <span class="product-badge">New</span>
                <img src="${item.image_url}" alt="${item.name}" class="product-image">
            </div>
            <div class="product-info">
                <p class="product-category">${item.category}</p>
                <h3 class="product-name">${item.name}</h3>
                <p class="product-price">$${item.price.toFixed(2)}</p>
                <button class="btn btn-secondary" onclick="event.stopPropagation(); addToCart(${item.id})">Add to Cart</button>
            </div>
        </div>
    `).join('');
}

// Modal logic
function openModal(id) {
    selectedProduct = products.find(p => p.id === id);
    if (!selectedProduct) return;

    document.getElementById('modal-image').src = selectedProduct.image_url;
    document.getElementById('modal-name').innerText = selectedProduct.name;
    document.getElementById('modal-category').innerText = selectedProduct.category;
    document.getElementById('modal-description').innerText = selectedProduct.description;
    document.getElementById('modal-price').innerText = `$${selectedProduct.price.toFixed(2)}`;
    
    document.getElementById('product-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('product-modal').style.display = 'none';
}

window.onclick = (event) => {
    if (event.target == document.getElementById('product-modal')) closeModal();
    if (event.target == document.getElementById('orders-modal')) closeOrdersModal();
};

// Cart logic
function toggleCart() {
    document.getElementById('cart-overlay').classList.toggle('open');
}

function addToCart(id) {
    const product = products.find(p => p.id === id);
    const existing = cart.find(item => item.id === id);
    
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    saveCart();
    updateCartUI();
    
    // Feedback
    const btn = event.target;
    const oldText = btn.innerText;
    btn.innerText = 'Added! ✓';
    btn.style.borderColor = 'var(--primary)';
    setTimeout(() => {
        btn.innerText = oldText;
        btn.style.borderColor = 'var(--border)';
    }, 1000);
}

function addToCartFromModal() {
    if (selectedProduct) {
        addToCart(selectedProduct.id);
        closeModal();
        toggleCart();
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartUI() {
    const cartItems = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const totalEl = document.getElementById('cart-total-price');
    
    cartCount.innerText = cart.reduce((acc, item) => acc + item.quantity, 0);
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 2rem;">Your cart is empty</p>';
        totalEl.innerText = '$0.00';
        return;
    }
    
    let total = 0;
    cartItems.innerHTML = cart.map((item, index) => {
        total += item.price * item.quantity;
        return `
            <div class="cart-item">
                <img src="${item.image_url}" alt="${item.name}">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p style="color: var(--text-muted)">$${item.price.toFixed(2)} x ${item.quantity}</p>
                    <button class="remove-item" onclick="removeFromCart(${index})">Remove</button>
                </div>
            </div>
        `;
    }).join('');
    
    totalEl.innerText = `$${total.toFixed(2)}`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

// Order logic
async function checkout() {
    if (!user) {
        alert('Please login to place an order.');
        location.href = '/login.html';
        return;
    }
    
    if (cart.length === 0) {
        alert('Your cart is empty.');
        return;
    }
    
    const totalPrice = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    
    const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: cart,
            total_price: totalPrice
        })
    });
    
    if (res.ok) {
        alert('Order placed successfully! Thank you for shopping with LuxeShop.');
        cart = [];
        saveCart();
        updateCartUI();
        toggleCart();
    } else {
        alert('Failed to place order. Please try again.');
    }
}
