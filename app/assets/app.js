const STORAGE_KEYS = {
  users: 'pd2.cafeteria.users',
  currentUser: 'pd2.cafeteria.currentUser',
  products: 'pd2.cafeteria.products',
  orders: 'pd2.cafeteria.orders'
};

const STATUS_FLOW = ['new', 'collecting', 'ready', 'issued'];
const STATUS_LABELS = {
  new: 'Новый',
  collecting: 'Собирается',
  ready: 'Готов к выдаче',
  issued: 'Выдан',
  cancelled: 'Отменен'
};

const PICKUP_SLOTS = [
  { value: '11:00', label: '11:00-11:15', available: true },
  { value: '11:15', label: '11:15-11:30', available: true },
  { value: '11:30', label: '11:30-11:45', available: true },
  { value: '11:45', label: '11:45-12:00', available: true },
  { value: '12:00', label: '12:00-12:15', available: true },
  { value: '12:15', label: '12:15-12:30', available: true },
  { value: '12:30', label: '12:30-12:45', available: true },
  { value: '12:45', label: '12:45-13:00', available: true },
  { value: '13:00', label: '13:00-13:15', available: true },
  { value: '13:15', label: '13:15-13:30', available: true },
  { value: '13:30', label: '13:30-13:45', available: true },
  { value: '13:45', label: '13:45-14:00', available: false }
];

const seedProducts = [
  {
    id: 1,
    title: 'Куриный суп',
    category: 'Первое',
    description: 'Готовое первое блюдо для быстрого обеда между парами.',
    price: 120,
    image: './assets/images/dish-1.svg',
    available: true
  },
  {
    id: 2,
    title: 'Котлета с пюре',
    category: 'Второе',
    description: 'Горячее блюдо из основного ассортимента студенческой столовой.',
    price: 210,
    image: './assets/images/dish-2.svg',
    available: true
  },
  {
    id: 3,
    title: 'Салат овощной',
    category: 'Салаты',
    description: 'Порционный салат из готовой витрины.',
    price: 95,
    image: './assets/images/dish-3.svg',
    available: true
  },
  {
    id: 4,
    title: 'Чай с лимоном',
    category: 'Напитки',
    description: 'Напиток к заказу с выдачей на кассе.',
    price: 45,
    image: './assets/images/dish-1.svg',
    available: true
  },
  {
    id: 5,
    title: 'Булочка с маком',
    category: 'Выпечка',
    description: 'Готовая выпечка для быстрого перекуса.',
    price: 60,
    image: './assets/images/dish-2.svg',
    available: true
  }
];

const seedUsers = [
  {
    id: 1,
    name: 'Сотрудник столовой',
    username: 'admin',
    password: 'admin123',
    role: 'staff'
  }
];

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeLogin(login) {
  return login.trim().toLowerCase();
}

const { createApp, computed, reactive, ref, watch } = Vue;

createApp({
  setup() {
    const users = ref(readStorage(STORAGE_KEYS.users, seedUsers));
    const currentUser = ref(readStorage(STORAGE_KEYS.currentUser, null));
    const products = ref(readStorage(STORAGE_KEYS.products, seedProducts));
    const orders = ref(readStorage(STORAGE_KEYS.orders, []));
    const cart = ref([]);

    const authMode = ref('login');
    const activeView = ref('menu');
    const activeCategory = ref('Все');
    const pickupTime = ref('12:30');
    const pickupSlots = ref(PICKUP_SLOTS);
    const orderComment = ref('');
    const staffStatusFilter = ref('all');
    const authMessage = reactive({ text: '', type: '' });
    const loginForm = reactive({ username: '', password: '' });
    const registerForm = reactive({ name: '', username: '', password: '' });

    const isStaff = computed(() => currentUser.value?.role === 'staff');
    const statuses = computed(() => Object.keys(STATUS_LABELS));
    const categories = computed(() => [...new Set(products.value.map(product => product.category))]);
    const availableProducts = computed(() => products.value.filter(product => product.available));
    const filteredProducts = computed(() => {
      return availableProducts.value.filter(product => activeCategory.value === 'Все' || product.category === activeCategory.value);
    });
    const cartCount = computed(() => cart.value.reduce((sum, item) => sum + item.count, 0));
    const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + item.price * item.count, 0));
    const userOrders = computed(() => {
      return orders.value
        .filter(order => order.customerId === currentUser.value?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
    const activeOrders = computed(() => {
      return orders.value.filter(order => !['issued', 'cancelled'].includes(order.status));
    });
    const staffOrders = computed(() => {
      return orders.value
        .filter(order => staffStatusFilter.value === 'all' || order.status === staffStatusFilter.value)
        .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));
    });

    watch(users, value => writeStorage(STORAGE_KEYS.users, value), { deep: true });
    watch(currentUser, value => writeStorage(STORAGE_KEYS.currentUser, value), { deep: true });
    watch(products, saveProducts, { deep: true });
    watch(orders, value => writeStorage(STORAGE_KEYS.orders, value), { deep: true });

    function showMessage(text, type = 'error') {
      authMessage.text = text;
      authMessage.type = type;
    }

    function login() {
      const username = normalizeLogin(loginForm.username);
      const user = users.value.find(item => normalizeLogin(item.username) === username && item.password === loginForm.password);

      if (!user) {
        showMessage('Неверный логин или пароль');
        return;
      }

      currentUser.value = { id: user.id, name: user.name, username: user.username, role: user.role };
      showMessage('');
      activeView.value = user.role === 'staff' ? 'staff' : 'menu';
    }

    function register() {
      const username = normalizeLogin(registerForm.username);

      if (!registerForm.name || !username || registerForm.password.length < 6) {
        showMessage('Заполните имя, логин и пароль от 6 символов');
        return;
      }

      const exists = users.value.some(user => normalizeLogin(user.username) === username);
      if (exists) {
        showMessage('Пользователь с таким логином уже существует');
        return;
      }

      users.value.push({
        id: Date.now(),
        name: registerForm.name,
        username: registerForm.username,
        password: registerForm.password,
        role: 'student'
      });

      loginForm.username = registerForm.username;
      loginForm.password = '';
      registerForm.name = '';
      registerForm.username = '';
      registerForm.password = '';
      authMode.value = 'login';
      showMessage('Аккаунт создан. Выполните вход', 'success');
    }

    function logout() {
      currentUser.value = null;
      cart.value = [];
      activeView.value = 'menu';
    }

    function addToCart(product) {
      const item = cart.value.find(cartItem => cartItem.id === product.id);
      if (item) {
        item.count += 1;
        return;
      }

      cart.value.push({
        id: product.id,
        title: product.title,
        price: product.price,
        count: 1
      });
    }

    function changeCartCount(productId, delta) {
      const item = cart.value.find(cartItem => cartItem.id === productId);
      if (!item) {
        return;
      }

      item.count += delta;
      if (item.count <= 0) {
        cart.value = cart.value.filter(cartItem => cartItem.id !== productId);
      }
    }

    function createOrder() {
      if (cart.value.length === 0) {
        return;
      }

      const createdAt = new Date().toISOString();
      orders.value.push({
        id: Date.now(),
        number: String(orders.value.length + 1).padStart(4, '0'),
        customerId: currentUser.value.id,
        customerName: currentUser.value.name,
        items: cart.value.map(item => ({ ...item })),
        total: cartTotal.value,
        pickupTime: pickupTime.value,
        comment: orderComment.value,
        status: 'new',
        createdAt
      });

      cart.value = [];
      orderComment.value = '';
      activeView.value = 'orders';
    }

    function advanceOrder(order) {
      const currentIndex = STATUS_FLOW.indexOf(order.status);
      if (currentIndex === -1 || currentIndex === STATUS_FLOW.length - 1) {
        return;
      }

      order.status = STATUS_FLOW[currentIndex + 1];
    }

    function saveProducts() {
      writeStorage(STORAGE_KEYS.products, products.value);
    }

    function formatPrice(price) {
      return `${price.toLocaleString('ru-RU')} ₽`;
    }

    function formatDate(date) {
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(date));
    }

    function statusTitle(status) {
      return STATUS_LABELS[status] || status;
    }

    return {
      authMode,
      activeView,
      activeCategory,
      pickupTime,
      pickupSlots,
      orderComment,
      staffStatusFilter,
      authMessage,
      loginForm,
      registerForm,
      currentUser,
      isStaff,
      products,
      cart,
      categories,
      statuses,
      availableProducts,
      filteredProducts,
      cartCount,
      cartTotal,
      userOrders,
      activeOrders,
      staffOrders,
      login,
      register,
      logout,
      addToCart,
      changeCartCount,
      createOrder,
      advanceOrder,
      saveProducts,
      formatPrice,
      formatDate,
      statusTitle
    };
  }
}).mount('#app');
