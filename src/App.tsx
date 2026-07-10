import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { supabase, Saree } from './lib/supabase';
import { ShoppingBag, Loader2, Search, X, Package, CheckCircle, Clock, ArrowLeft, ChevronRight, Check, Lock, Plus, Trash2, Heart, Printer } from 'lucide-react';
import ShippingDashboard from './ShippingDashboard';

// Extend Saree interface locally to ensure all fields are typed
export interface ExtendedSaree extends Saree {
  collection_type?: string;
  badge?: string;
  sizes?: string;
  is_out_of_stock?: boolean;
  category?: string;
  style?: string;
  collection?: string;
  createdAt?: string;
  display_price?: string | number;
  rate?: string | number;
  title?: string;
  _id?: string;
  rating?: number;
}

export interface CartItem {
  id: string;
  product: ExtendedSaree;
  quantity: number;
  sizeOption?: string;
  pompomOption?: boolean;
}

// --- Types ---
export interface Order {
  id: string;
  saree_name: string;
  price: number;
  status: string;
  created_at: string;
  payment_status?: string;
  category?: string;
  collection?: string;
  collection_type?: string;
}

export interface Review {
  id: string;
  product_id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

// --- Storefront Page ---
function Storefront() {
  const [sarees, setSarees] = useState<ExtendedSaree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [selectedSaree, setSelectedSaree] = useState<ExtendedSaree | null>(null);
  const [sortBy, setSortBy] = useState('newest'); // Options: 'price-low', 'price-high', 'newest'
  const [reviews, setReviews] = useState<Review[]>([]);
  const [minRating, setMinRating] = useState<number>(0);

  // Review Form state
  const [reviewerName, setReviewerName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Checkout & Shipping Form states
  const [checkoutStage, setCheckoutStage] = useState<'cart' | 'shipping' | 'payment-submitted'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [pincode, setPincode] = useState('');

  // Payment Verification states
  const [tempPaymentId, setTempPaymentId] = useState('');
  const [latestOrderId, setLatestOrderId] = useState<string | null>(null);

  // Customer Portal / Drawer states
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [customerPhoneQuery, setCustomerPhoneQuery] = useState('');
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [portalPaymentId, setPortalPaymentId] = useState<Record<string, string>>({});

  const handleSubmitPaymentId = async () => {
    if (!tempPaymentId.trim()) {
      alert("Please enter your Payment ID.");
      return;
    }
    if (!latestOrderId) {
      alert("No active order found. Please try again.");
      return;
    }
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: `Awaiting Verification (ID: ${tempPaymentId.trim()})`
        })
        .eq('id', latestOrderId);

      if (error) throw error;
      alert("Payment ID submitted successfully! Our team will verify and approve your order shortly.");
      setCart([]);
      setIsCartOpen(false);
      setCheckoutStage('cart');
      setTempPaymentId('');
      setLatestOrderId(null);
    } catch (err) {
      console.error("Error submitting payment ID:", err);
      alert("Failed to submit Payment ID. Please try again or contact support.");
    }
  };

  const handleDirectSearch = async () => {
    const cleanPhone = String(customerPhoneQuery || "").trim();
    if (!cleanPhone) return;

    // Setup safety flags
    if (typeof setIsFetchingOrders === 'function') setIsFetchingOrders(true);

    try {
      // Loose text checking to find exact matches for '1'
      const { data, error: dbError } = await supabase
        .from('orders')
        .select('*')
        .or(`phone_number.eq.${cleanPhone},phone_number.ilike.%${cleanPhone}%`)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      if (typeof setCustomerOrders === 'function') {
        setCustomerOrders(data || []);
      }
    } catch (err) {
      console.error("Search system error catch:", err);
      if (typeof setCustomerOrders === 'function') setCustomerOrders([]);
    } finally {
      if (typeof setIsFetchingOrders === 'function') setIsFetchingOrders(false);
    }
  };

  const handleSubmitPortalPaymentId = async (orderId: string) => {
    const payId = portalPaymentId[orderId];
    if (!payId || !payId.trim()) {
      alert("Please enter a Payment ID.");
      return;
    }
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: `Awaiting Verification (ID: ${payId.trim()})`
        })
        .eq('id', orderId);

      if (error) throw error;
      alert("Payment ID submitted successfully for verification!");
      setCustomerOrders(customerOrders.map(o => o.id === orderId ? { ...o, payment_status: `Awaiting Verification (ID: ${payId.trim()})` } : o));
    } catch (err) {
      console.error("Error updating payment ID:", err);
      alert("Failed to submit Payment ID.");
    }
  };

  useEffect(() => {
    async function fetchReviews() {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*');
        if (error) throw error;
        if (data) setReviews(data as Review[]);
      } catch (err) {
        console.error("Error fetching reviews:", err);
      }
    }
    fetchReviews();
  }, []);

  // Modal selections state
  const [selectedSize, setSelectedSize] = useState<string>('L'); // default to L
  const [addPompom, setAddPompom] = useState<boolean>(false);

  // Shopping Cart & Wishlist States
  const [wishlist, setWishlist] = useState<ExtendedSaree[]>(() => {
    try {
      const saved = localStorage.getItem('shahi_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('shahi_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCheckoutItems, setSelectedCheckoutItems] = useState<CartItem[] | null>(null);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cart.reduce((total, item) => {
    const saree = item.product;
    const isPompom = item.pompomOption ?? false;
    const colType = (saree.collection_type || '').trim().toLowerCase();
    let itemPrice = saree.price;
    if (colType === 'avaasa cordsets') {
      itemPrice = 990;
    } else if (colType === 'bagru block prints') {
      itemPrice = isPompom ? 950 : 900;
    }
    return total + (itemPrice * item.quantity);
  }, 0);

  const checkoutItemsList = selectedCheckoutItems || cart;
  const checkoutSubtotal = checkoutItemsList.reduce((total, item) => {
    const saree = item.product;
    const isPompom = item.pompomOption ?? false;
    const colType = (saree.collection_type || '').trim().toLowerCase();
    let itemPrice = saree.price;
    if (colType === 'avaasa cordsets') {
      itemPrice = 990;
    } else if (colType === 'bagru block prints') {
      itemPrice = isPompom ? 950 : 900;
    }
    return total + (itemPrice * item.quantity);
  }, 0);
  const grandTotal = checkoutSubtotal + 60;

  useEffect(() => {
    localStorage.setItem('shahi_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('shahi_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    async function fetchSarees() {
      try {
        const { data, error } = await supabase
          .from('sarees')
          .select('*')
          .order('id', { ascending: true });

        if (error) throw error;
        if (data) {
          // Log each item's collection_type for debugging
          data.forEach(item => {
            console.log("Returned collection_type:", item.collection_type);
          });
          setSarees(data as ExtendedSaree[]);
        }
      } catch (err: any) {
        console.error("Error fetching sarees:", err);
        setError("Failed to load the boutique collection.");
      } finally {
        setLoading(false);
      }
    }
    fetchSarees();
  }, []);

  const uniqueCollections = Array.from(
    new Set(sarees.map(s => s.category || s.collection || s.collection_type).filter(Boolean))
  ) as string[];

  // Calculate final pricing & display price
  const getProductPrice = (saree: ExtendedSaree, pompomOption?: boolean) => {
    const colType = (saree.collection_type || '').trim().toLowerCase();
    if (colType === 'avaasa cordsets') {
      return 990;
    }
    if (colType === 'bagru block prints') {
      return pompomOption ? 950 : 900;
    }
    return saree.price;
  };


  const handleBuyNow = (saree: ExtendedSaree, sizeOption?: string, pompomOption?: boolean) => {
    const colType = (saree.collection_type || '').trim().toLowerCase();
    const finalSize = sizeOption || (colType === 'avaasa cordsets' ? 'L' : undefined);
    const finalPompom = pompomOption ?? (colType === 'bagru block prints' ? false : undefined);
    let uniqueId = saree.id.toString();
    if (finalSize) uniqueId += `-${finalSize}`;
    if (finalPompom !== undefined) uniqueId += `-${finalPompom ? 'pompom' : 'nopompom'}`;

    const checkoutItem: CartItem = {
      id: uniqueId,
      product: saree,
      quantity: 1,
      sizeOption: finalSize,
      pompomOption: finalPompom
    };

    setSelectedCheckoutItems([checkoutItem]);
    setCheckoutStage('shipping');
    setIsCartOpen(true);
  };

  const handleAddToBag = (saree: ExtendedSaree, sizeOption?: string, pompomOption?: boolean) => {
    const colType = (saree.collection_type || '').trim().toLowerCase();
    const finalSize = sizeOption || (colType === 'avaasa cordsets' ? 'L' : undefined);
    const finalPompom = pompomOption ?? (colType === 'bagru block prints' ? false : undefined);

    let uniqueId = saree.id.toString();
    if (finalSize) uniqueId += `-${finalSize}`;
    if (finalPompom !== undefined) uniqueId += `-${finalPompom ? 'pompom' : 'nopompom'}`;

    const existingIndex = cart.findIndex(item => item.id === uniqueId);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        id: uniqueId,
        product: saree,
        quantity: 1,
        sizeOption: finalSize,
        pompomOption: finalPompom
      }]);
    }
    setIsCartOpen(true);
  };
  const handleProceedToPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!customerName || !phoneNumber || !shippingAddress || !pincode) {
      alert("Please fill in all mandatory shipping details.");
      return;
    }

    try {
      // 1. Clear internal IDs from the items list payload
      const cleanItemsList = Array.isArray(checkoutItemsList) 
        ? checkoutItemsList.map(({ id, ...rest }) => rest)
        : checkoutItemsList;

      const orderTotal = Number(parseFloat(String(grandTotal || 0)));

      const finalizedPayload = {
        saree_name: JSON.stringify(cleanItemsList),
        price: orderTotal,
        status: 'Pending Payment',
        customer_name: String(customerName),
        phone_number: String(phoneNumber),
        shipping_address: String(shippingAddress),
        pincode: String(pincode)
      };

      // 2. Save order details to Supabase
      const { data, error } = await supabase.from('orders').insert(finalizedPayload).select();
      if (error) {
        alert(`Database rejection: ${error.message}`);
        return;
      }

      // 3. Inject Razorpay script dynamically and trigger the secure checkout modal
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Loaded from environment variables
          amount: Math.round(orderTotal * 100), // Enforces exact total price in paise (multiplied by 100)
          currency: "INR",
          name: "Shah's Boutique",
          description: "Secure Order Checkout",
          handler: async function (response: any) {
            alert("Payment authorized successfully! Payment ID: " + response.razorpay_payment_id);
            
            // Update order status in Supabase upon successful verification
            if (data && data[0]) {
              await supabase.from('orders').update({ status: 'Paid' }).eq('id', data[0].id);
            }
            
            // Reset layouts and state
            setIsCartOpen(false);
            setCheckoutStage('payment-submitted');
            setCart([]);
          },
          prefill: {
            name: customerName,
            contact: phoneNumber
          },
          theme: { color: "#004D40" }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };
      document.body.appendChild(script);

    } catch (err: any) {
      console.error("Payment setup crash:", err);
      alert("An error occurred during checkout setup.");
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaree) return;
    if (!reviewerName.trim() || !reviewComment.trim()) {
      alert("Please fill in your name and comment.");
      return;
    }
    setIsSubmittingReview(true);
    try {
      const reviewPayload = {
        product_id: selectedSaree.id.toString(),
        reviewer_name: reviewerName.trim(),
        rating: reviewRating,
        comment: reviewComment.trim(),
      };
      
      const { data, error } = await supabase
        .from('reviews')
        .insert([reviewPayload])
        .select();

      if (error) throw error;
      if (data && data[0]) {
        setReviews([data[0] as Review, ...reviews]);
      } else {
        const { data: refreshed } = await supabase.from('reviews').select('*');
        if (refreshed) setReviews(refreshed as Review[]);
      }

      setReviewerName('');
      setReviewRating(5);
      setReviewComment('');
      alert("Review submitted successfully!");
    } catch (err) {
      console.error("Error submitting review:", err);
      alert("Failed to submit review. Please try again.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Reset modal state on open
  const openModal = (saree: ExtendedSaree) => {
    setSelectedSize('L');
    setAddPompom(false);
    setSelectedSaree(saree);
  };

  const parsePrice = (product: ExtendedSaree) => {
    const priceRaw = product.price || product.display_price || product.rate || '0';
    // Strip out currency symbols, commas, and whitespace to extract the pure number
    const cleaned = String(priceRaw).replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const products = [...sarees];
  const filteredProducts = products
    .map(product => {
      const productReviews = reviews.filter(r => r.product_id === product.id.toString());
      const reviewCount = productReviews.length;
      const avg = reviewCount > 0 
        ? productReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        : 0;
      return {
        ...product,
        rating: avg
      };
    })
    // A. Filter by search query (checks name, description, style, or collection)
    .filter(product => {
      const query = searchQuery.toLowerCase();
      const productCategory = (product.category || product.collection || product.collection_type || 'item').toLowerCase();
      return (
        product.name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.style?.toLowerCase().includes(query) ||
        productCategory.includes(query)
      );
    })
    // B. Fix the Collections Filter to Fallback Gracefully
    .filter(product => {
      const selectedCollection = selectedFilter;
      if (selectedCollection === 'All' || selectedCollection === 'all' || !selectedCollection || selectedCollection.includes('Select')) return true;
      
      // Safely gather any classification strings attached to the product
      const productCategory = (product.category || product.collection || product.collection_type || 'item').toLowerCase();
      const descriptionStr = (product.description || '').toLowerCase();
      const nameStr = (product.name || product.title || '').toLowerCase();
      const target = selectedCollection.toLowerCase();

      return productCategory === target || 
             productCategory.includes(target) ||
             descriptionStr.includes(target) ||
             nameStr.includes(target);
    })
    // C. Filter by minimum rating
    .filter(product => {
      if (minRating === 0) return true;
      return (product.rating || 0) >= minRating;
    });

  const processedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'low-high') {
      return parsePrice(a) - parsePrice(b);
    }
    if (sortBy === 'high-low') {
      return parsePrice(b) - parsePrice(a);
    }
    if (sortBy === 'newest') {
      const dateA = new Date(a.createdAt || a.id || 0);
      const dateB = new Date(b.createdAt || b.id || 0);
      // @ts-ignore
      return dateB - dateA;
    }
    if (sortBy === 'rating') {
      return Number(b.rating || 0) - Number(a.rating || 0);
    }
    return 0;
  });

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#FDFDFB] text-stone-800">
      {/* Global Navigation Icons & Badges */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 w-auto max-w-md ml-auto pointer-events-auto">
        <button
          onClick={() => setIsMyOrdersOpen(true)}
          className="flex-1 sm:flex-none min-w-[90px] flex items-center justify-center gap-1.5 px-3 py-2 bg-white/95 text-stone-850 border border-stone-200/80 hover:bg-stone-50 rounded-lg shadow-md transition-all text-xs sm:text-sm font-bold font-sans uppercase tracking-wide"
        >
          <Package className="w-4 h-4 text-[#004225]" />
          <span>My Orders</span>
        </button>

        <button
          onClick={() => setIsWishlistOpen(true)}
          className="flex-1 sm:flex-none min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 bg-white/95 text-stone-850 border border-stone-200/80 hover:bg-stone-50 rounded-lg shadow-md transition-all text-xs sm:text-sm font-bold font-sans uppercase tracking-wide"
        >
          <Heart className="w-4 h-4 text-[#E11D48] fill-[#E11D48]" />
          <span>Wishlist ({wishlist.length})</span>
        </button>

        <button
          onClick={() => setIsCartOpen(true)}
          className="flex-1 sm:flex-none min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 bg-[#004225] hover:bg-[#005c34] text-white rounded-lg shadow-md transition-all text-xs sm:text-sm font-bold font-sans uppercase tracking-wide border border-[#D4AF37]/35"
        >
          <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
          <span>Cart ({cartCount}) - ₹{cartSubtotal}</span>
        </button>
      </div>

      {/* 1. Header & Identity Design */}
      <header 
        className="relative min-h-[320px] md:min-h-[380px] lg:min-h-[480px] bg-[#0B4D3A] border-b border-stone-200/20 overflow-hidden flex flex-col justify-center py-10 md:py-14"
      >
        {/* Background glow & floats */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {/* Radial soft golden glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.18)_0%,_transparent_65%)]" />
          
          {/* Floating gold sparkle particles */}
          <div className="absolute top-[20%] left-[12%] w-2 h-2 bg-[#D4AF37] rounded-full blur-[1px] sparkle-slow-1" />
          <div className="absolute top-[45%] left-[82%] w-1.5 h-1.5 bg-[#D4AF37] rounded-full blur-[1px] sparkle-slow-2" />
          <div className="absolute top-[75%] left-[22%] w-2.5 h-2.5 bg-[#D4AF37] rounded-full blur-[1px] sparkle-slow-3" />
          <div className="absolute top-[30%] right-[18%] w-2 h-2 bg-[#D4AF37] rounded-full blur-[1px] sparkle-slow-1" />
          <div className="absolute top-[68%] right-[12%] w-1.5 h-1.5 bg-[#D4AF37] rounded-full blur-[1px] sparkle-slow-2" />
        </div>

        {/* Elegant corner gold luxury botanical frame */}
        {/* Top Left */}
        <svg className="absolute top-0 left-0 w-32 h-32 md:w-44 md:h-44 lg:w-52 lg:h-52 pointer-events-none z-10" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGradTL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#AA771C" />
              <stop offset="20%" stopColor="#FBF5B7" />
              <stop offset="40%" stopColor="#D4AF37" />
              <stop offset="60%" stopColor="#F3E5AB" />
              <stop offset="80%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#AA771C" />
            </linearGradient>
          </defs>
          {/* Soft local gold glow behind branches for depth */}
          <circle cx="40" cy="40" r="60" fill="#D4AF37" opacity="0.15" filter="blur(20px)" />
          
          {/* Main vine 1 */}
          <path d="M 0 0 C 30 15, 70 30, 95 65 C 115 95, 105 140, 130 175" stroke="url(#goldGradTL)" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          {/* Main vine 2 (shorter) */}
          <path d="M 0 30 C 40 45, 65 85, 60 125" stroke="url(#goldGradTL)" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
          {/* Main vine 3 (horizontal reach) */}
          <path d="M 30 0 C 45 40, 85 55, 145 60" stroke="url(#goldGradTL)" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

          {/* Olive leaves on Vine 1 */}
          <path d="M 35 20 Q 42 12, 48 18 Q 40 26, 35 20" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 65 32 Q 76 28, 80 36 Q 70 42, 65 32" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 88 55 Q 98 52, 104 60 Q 94 66, 88 55" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 110 88 Q 124 92, 122 102 Q 112 100, 110 88" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 115 120 Q 125 128, 120 136 Q 112 128, 115 120" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 122 155 Q 135 158, 134 168 Q 123 164, 122 155" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />

          {/* Round Eucalyptus-style leaves on Vine 2 */}
          <path d="M 22 36 C 24 30, 34 30, 32 38 C 30 44, 20 42, 22 36 Z" fill="url(#goldGradTL)" fillOpacity="0.2" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 45 60 C 50 54, 58 58, 55 65 C 52 70, 42 66, 45 60 Z" fill="url(#goldGradTL)" fillOpacity="0.2" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 62 90 C 70 85, 75 92, 70 98 C 65 102, 58 96, 62 90 Z" fill="url(#goldGradTL)" fillOpacity="0.2" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 60 115 C 68 112, 70 120, 65 125 C 60 128, 55 122, 60 115 Z" fill="url(#goldGradTL)" fillOpacity="0.2" stroke="url(#goldGradTL)" strokeWidth="1" />

          {/* Delicate leaves on Vine 3 */}
          <path d="M 50 12 Q 54 2, 62 6 Q 56 16, 50 12" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 80 22 Q 88 15, 96 20 Q 88 30, 80 22" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 112 36 Q 122 32, 128 40 Q 118 46, 112 36" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />
          <path d="M 132 50 Q 144 52, 142 60 Q 132 58, 132 50" fill="url(#goldGradTL)" fillOpacity="0.15" stroke="url(#goldGradTL)" strokeWidth="1" />

          {/* Tiny Buds */}
          <circle cx="75" cy="22" r="2" fill="url(#goldGradTL)" />
          <circle cx="102" cy="72" r="1.5" fill="url(#goldGradTL)" />
          <circle cx="50" cy="100" r="2" fill="url(#goldGradTL)" />
          <circle cx="120" cy="145" r="1.5" fill="url(#goldGradTL)" />

          {/* Scattered Sparkles */}
          <path d="M 45 42 L 46 45 L 49 46 L 46 47 L 45 50 L 44 47 L 41 46 L 44 45 Z" fill="url(#goldGradTL)" opacity="0.9" />
          <path d="M 105 32 L 106 34 L 108 35 L 106 36 L 105 38 L 104 36 L 102 35 L 104 34 Z" fill="url(#goldGradTL)" opacity="0.8" />
          <path d="M 80 120 L 81 122 L 83 123 L 81 124 L 80 126 L 79 124 L 77 123 L 79 122 Z" fill="url(#goldGradTL)" opacity="0.85" />
        </svg>

        {/* Top Right */}
        <svg className="absolute top-0 right-0 w-32 h-32 md:w-44 md:h-44 lg:w-52 lg:h-52 pointer-events-none z-10" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGradTR" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#AA771C" />
              <stop offset="25%" stopColor="#FBF5B7" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="75%" stopColor="#F3E5AB" />
              <stop offset="100%" stopColor="#AA771C" />
            </linearGradient>
          </defs>
          <circle cx="160" cy="40" r="60" fill="#D4AF37" opacity="0.15" filter="blur(20px)" />
          
          {/* Vine 1 */}
          <path d="M 200 0 C 170 20, 130 35, 110 70 C 90 105, 100 150, 70 185" stroke="url(#goldGradTR)" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          {/* Vine 2 */}
          <path d="M 200 40 C 155 50, 130 95, 140 140" stroke="url(#goldGradTR)" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
          {/* Vine 3 */}
          <path d="M 160 0 C 140 45, 95 65, 35 65" stroke="url(#goldGradTR)" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

          {/* Olive leaves on Vine 1 */}
          <path d="M 165 22 Q 155 15, 150 20 Q 158 28, 165 22" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 135 36 Q 124 30, 118 38 Q 128 44, 135 36" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 112 60 Q 100 58, 96 66 Q 106 72, 112 60" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 98 95 Q 86 98, 88 108 Q 98 106, 98 95" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 100 130 Q 90 136, 94 144 Q 102 138, 100 130" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 82 160 Q 70 166, 74 174 Q 82 168, 82 160" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />

          {/* Eucalyptus leaves on Vine 2 */}
          <path d="M 175 48 C 170 42, 162 44, 165 52 C 168 58, 178 56, 175 48 Z" fill="url(#goldGradTR)" fillOpacity="0.2" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 152 75 C 146 70, 138 72, 140 80 C 142 86, 152 84, 152 75 Z" fill="url(#goldGradTR)" fillOpacity="0.2" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 135 105 C 128 100, 122 105, 125 112 C 128 118, 138 116, 135 105 Z" fill="url(#goldGradTR)" fillOpacity="0.2" stroke="url(#goldGradTR)" strokeWidth="1" />

          {/* Leaves on Vine 3 */}
          <path d="M 148 15 Q 142 5, 135 10 Q 142 20, 148 15" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 115 28 Q 108 20, 100 25 Q 108 35, 115 28" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 85 42 Q 75 38, 70 46 Q 80 52, 85 42" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />
          <path d="M 55 52 Q 45 50, 42 58 Q 52 60, 55 52" fill="url(#goldGradTR)" fillOpacity="0.15" stroke="url(#goldGradTR)" strokeWidth="1" />

          {/* Buds */}
          <circle cx="125" cy="22" r="1.5" fill="url(#goldGradTR)" />
          <circle cx="102" cy="82" r="2" fill="url(#goldGradTR)" />
          <circle cx="145" cy="120" r="1.5" fill="url(#goldGradTR)" />
          
          {/* Sparkles */}
          <path d="M 155 35 L 156 38 L 159 39 L 156 40 L 155 43 L 154 40 L 151 39 L 154 38 Z" fill="url(#goldGradTR)" opacity="0.85" />
          <path d="M 90 55 L 91 57 L 93 58 L 91 59 L 90 61 L 89 59 L 87 58 L 89 57 Z" fill="url(#goldGradTR)" opacity="0.9" />
          <path d="M 115 130 L 116 132 L 118 133 L 116 134 L 115 136 L 114 134 L 112 133 L 114 132 Z" fill="url(#goldGradTR)" opacity="0.8" />
        </svg>

        {/* Bottom Left */}
        <svg className="absolute bottom-0 left-0 w-32 h-32 md:w-44 md:h-44 lg:w-52 lg:h-52 pointer-events-none z-10" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGradBL" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#AA771C" />
              <stop offset="25%" stopColor="#FBF5B7" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="75%" stopColor="#F3E5AB" />
              <stop offset="100%" stopColor="#AA771C" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="160" r="60" fill="#D4AF37" opacity="0.15" filter="blur(20px)" />
          
          {/* Vine 1 */}
          <path d="M 0 200 C 30 180, 65 165, 85 130 C 105 95, 95 50, 125 15" stroke="url(#goldGradBL)" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          {/* Vine 2 */}
          <path d="M 0 160 C 45 150, 70 105, 60 60" stroke="url(#goldGradBL)" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
          {/* Vine 3 */}
          <path d="M 40 200 C 55 155, 100 135, 160 135" stroke="url(#goldGradBL)" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

          {/* Olive leaves on Vine 1 */}
          <path d="M 32 178 Q 42 185, 48 180 Q 40 172, 32 178" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 60 162 Q 70 168, 76 160 Q 66 154, 60 162" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 82 140 Q 94 142, 98 134 Q 88 128, 82 140" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 98 105 Q 110 102, 108 92 Q 98 94, 98 105" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 96 70 Q 106 64, 102 56 Q 94 62, 96 70" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 112 40 Q 124 34, 120 26 Q 112 32, 112 40" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />

          {/* Eucalyptus leaves on Vine 2 */}
          <path d="M 25 152 C 30 158, 38 156, 35 148 C 32 142, 22 144, 25 152 Z" fill="url(#goldGradBL)" fillOpacity="0.2" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 48 125 C 54 130, 62 128, 60 120 C 58 114, 48 116, 48 125 Z" fill="url(#goldGradBL)" fillOpacity="0.2" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 65 95 C 72 100, 78 95, 75 88 C 72 82, 62 84, 65 95 Z" fill="url(#goldGradBL)" fillOpacity="0.2" stroke="url(#goldGradBL)" strokeWidth="1" />

          {/* Leaves on Vine 3 */}
          <path d="M 52 185 Q 58 195, 65 190 Q 58 180, 52 185" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 85 172 Q 92 180, 100 175 Q 92 165, 85 172" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 115 158 Q 125 162, 130 154 Q 120 148, 115 158" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />
          <path d="M 145 148 Q 155 150, 158 142 Q 148 140, 145 148" fill="url(#goldGradBL)" fillOpacity="0.15" stroke="url(#goldGradBL)" strokeWidth="1" />

          {/* Buds */}
          <circle cx="75" cy="178" r="1.5" fill="url(#goldGradBL)" />
          <circle cx="98" cy="118" r="2" fill="url(#goldGradBL)" />
          <circle cx="55" cy="80" r="1.5" fill="url(#goldGradBL)" />
          
          {/* Sparkles */}
          <path d="M 45 165 L 46 168 L 49 169 L 46 170 L 45 173 L 44 170 L 41 169 L 44 168 Z" fill="url(#goldGradBL)" opacity="0.85" />
          <path d="M 110 145 L 111 147 L 113 148 L 111 149 L 110 151 L 109 149 L 107 148 L 109 147 Z" fill="url(#goldGradBL)" opacity="0.9" />
          <path d="M 85 70 L 86 72 L 88 73 L 86 74 L 85 76 L 84 74 L 82 73 L 84 72 Z" fill="url(#goldGradBL)" opacity="0.8" />
        </svg>

        {/* Bottom Right */}
        <svg className="absolute bottom-0 right-0 w-32 h-32 md:w-44 md:h-44 lg:w-52 lg:h-52 pointer-events-none z-10" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGradBR" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#AA771C" />
              <stop offset="25%" stopColor="#FBF5B7" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="75%" stopColor="#F3E5AB" />
              <stop offset="100%" stopColor="#AA771C" />
            </linearGradient>
          </defs>
          <circle cx="160" cy="160" r="60" fill="#D4AF37" opacity="0.15" filter="blur(20px)" />
          
          {/* Vine 1 */}
          <path d="M 200 200 C 170 185, 130 170, 105 135 C 85 105, 95 60, 70 25" stroke="url(#goldGradBR)" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          {/* Vine 2 */}
          <path d="M 200 160 C 155 150, 130 105, 140 60" stroke="url(#goldGradBR)" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
          {/* Vine 3 */}
          <path d="M 160 200 C 145 155, 100 145, 40 145" stroke="url(#goldGradBR)" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

          {/* Olive leaves on Vine 1 */}
          <path d="M 168 178 Q 158 185, 152 180 Q 160 172, 168 178" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 140 162 Q 130 168, 124 160 Q 134 154, 140 162" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 118 140 Q 106 142, 102 134 Q 112 128, 118 140" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 102 105 Q 90 102, 92 92 Q 102 94, 102 105" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 104 70 Q 94 64, 98 56 Q 106 62, 104 70" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 88 40 Q 76 34, 80 26 Q 88 32, 88 40" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />

          {/* Eucalyptus leaves on Vine 2 */}
          <path d="M 175 152 C 170 158, 162 156, 165 148 C 168 142, 178 144, 175 152 Z" fill="url(#goldGradBR)" fillOpacity="0.2" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 152 125 C 146 130, 138 128, 140 120 C 142 114, 152 116, 152 125 Z" fill="url(#goldGradBR)" fillOpacity="0.2" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 135 95 C 128 100, 122 95, 125 88 C 128 82, 138 84, 135 95 Z" fill="url(#goldGradBR)" fillOpacity="0.2" stroke="url(#goldGradBR)" strokeWidth="1" />

          {/* Leaves on Vine 3 */}
          <path d="M 148 185 Q 142 195, 135 190 Q 142 180, 148 185" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 115 172 Q 108 180, 100 175 Q 108 165, 115 172" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 85 158 Q 75 162, 70 154 Q 80 148, 85 158" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />
          <path d="M 55 148 Q 45 150, 42 142 Q 52 140, 55 148" fill="url(#goldGradBR)" fillOpacity="0.15" stroke="url(#goldGradBR)" strokeWidth="1" />

          {/* Buds */}
          <circle cx="125" cy="178" r="1.5" fill="url(#goldGradBR)" />
          <circle cx="102" cy="118" r="2" fill="url(#goldGradBR)" />
          <circle cx="145" cy="80" r="1.5" fill="url(#goldGradBR)" />
          
          {/* Sparkles */}
          <path d="M 155 165 L 156 168 L 159 169 L 156 170 L 155 173 L 154 170 L 151 169 L 154 168 Z" fill="url(#goldGradBR)" opacity="0.85" />
          <path d="M 90 145 L 91 147 L 93 148 L 91 149 L 90 151 L 89 149 L 87 148 L 89 147 Z" fill="url(#goldGradBR)" opacity="0.9" />
          <path d="M 115 70 L 116 72 L 118 73 L 116 74 L 115 76 L 114 74 L 112 73 L 114 72 Z" fill="url(#goldGradBR)" opacity="0.8" />
        </svg>

        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center text-center relative z-20 animate-fade-up">
          <div className="relative group">
            {/* Elegant gold accent ring blur */}
            <div className="absolute inset-0 m-auto w-[185px] h-[185px] md:w-[225px] md:h-[225px] rounded-md border border-[#D4AF37]/35 bg-[#D4AF37]/5 shadow-[0_0_80px_rgba(212,175,55,0.25)] blur-[1px] scale-110 pointer-events-none transition-all duration-700 group-hover:scale-125" />
            <img 
              src="https://hzmegeskbekbwuehpfks.supabase.co/storage/v1/object/public/assets/profile.jpeg" 
              alt="Shahi's Boutique Logo" 
              className="relative z-10 h-[163px] w-[163px] md:h-[204px] md:w-[204px] object-cover rounded-md border-2 border-[#D4AF37]/45 transition-transform duration-700 hover:rotate-1 animate-logo-glow"
            />
          </div>

          <h1 className="mt-8 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-bold tracking-[0.25em] sm:tracking-[0.3em] md:tracking-[0.35em] uppercase animate-gold-shimmer drop-shadow-lg">
            Shahi's Boutique
          </h1>
          <p className="mt-4 text-[10px] sm:text-xs md:text-sm font-serif tracking-[0.35em] sm:tracking-[0.4em] uppercase text-[#D4AF37]/90 font-medium max-w-xl mx-auto leading-relaxed">
            Exquisite Heritage & Contemporary Elegance
          </p>
          
          {/* Decorative Divider */}
          <div className="mt-8 flex items-center justify-center space-x-4 w-full max-w-sm sm:max-w-md mx-auto">
            <div className="h-[1px] bg-gradient-to-r from-transparent to-[#D4AF37]/60 flex-1" />
            <svg className="w-5 h-5 text-[#D4AF37]/80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C12 2 9 7 9 12C9 17 12 22 12 22C12 22 15 17 15 12C15 7 12 2 12 2Z" fill="currentColor" opacity="0.3" />
              <path d="M2 12C2 12 7 9 12 9C17 9 22 12 22 12C22 12 17 15 12 15C7 15 2 12 2 12Z" fill="currentColor" opacity="0.3" />
              <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" />
            </svg>
            <div className="h-[1px] bg-gradient-to-l from-transparent to-[#D4AF37]/60 flex-1" />
          </div>
        </div>

        {/* Traditional wave style design ornament border */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-3 bg-repeat-x opacity-90 pointer-events-none z-10" 
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='12' viewBox='0 0 40 12'%3E%3Cpath d='M0 6 Q 10 2, 20 6 T 40 6' fill='none' stroke='%23D4AF37' stroke-width='1.5'/%3E%3Cpath d='M0 6 Q 10 10, 20 6 T 40 6' fill='none' stroke='%23D4AF37' stroke-width='1.5'/%3E%3C/svg%3E")`
          }} 
        />
      </header>

      {/* Product Section Wrapper with Warm Cream Background */}
      <div className="bg-[#FAF6E9] flex-grow flex flex-col">
        {/* 2. Interactive Collection Filter Bar */}
        <div className="w-full bg-[#FCFBF7] border-b border-[#EBE9E0] py-4 px-4 sm:px-6 mb-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Enhanced, High-Visibility Luxury Search Input */}
            <div className="relative w-full md:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#9E7D3B]">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#EBE9E0] rounded-full text-sm sm:text-base font-medium text-[#1A332E] placeholder-[#8C8275]/60 transition-all duration-300 focus:outline-none focus:border-[#9E7D3B] focus:ring-1 focus:ring-[#9E7D3B] shadow-xs"
                placeholder="Search premium catalog..."
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-stone-200 rounded-full"
                >
                  <X className="w-3.5 h-3.5 text-stone-500" />
                </button>
              )}
            </div>
            {/* Responsive Premium Filter Container: Stacks neatly on mobile, row on desktop */}
            <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center bg-white border border-[#EBE9E0] rounded-2xl sm:rounded-full p-4 sm:py-1.5 sm:px-4 gap-4 sm:gap-0 shadow-[0_2px_8px_rgba(158,125,59,0.04)] hover:border-[#9E7D3B]/40 transition-all duration-300">
              
              {/* Collection Section */}
              <div className="flex items-center justify-between sm:justify-start gap-2 sm:pr-3 sm:border-r border-[#EBE9E0] pb-2 sm:pb-0 border-b sm:border-b-0 border-gray-100 sm:border-transparent">
                <span className="text-[#8C8275] font-bold tracking-wider text-xs sm:text-sm uppercase whitespace-nowrap">Collection:</span>
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="bg-transparent text-[#1A332E] font-medium py-1 px-2 mx-1 transition-colors duration-200 focus:outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239E7D3B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_auto] bg-[right_4px_center] bg-no-repeat pr-6 text-xs sm:text-sm"
                >
                  <option value="All">All Collections</option>
                  {uniqueCollections.map((col) => {
                    const displayName = col.toLowerCase() === 'narayanpet' ? 'Narayanpet Series' : col;
                    return (
                      <option key={col} value={col}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Sort Section with Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:px-3 sm:border-r border-[#EBE9E0] pb-2 sm:pb-0 border-b sm:border-b-0 border-gray-100 sm:border-transparent">
                <span className="text-[#8C8275] font-bold tracking-wider text-xs sm:text-sm uppercase whitespace-nowrap">Sort:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { id: 'newest', label: 'Newest' },
                    { id: 'low-high', label: 'Price: Low to High' },
                    { id: 'high-low', label: 'Price: High to Low' },
                    { id: 'rating', label: 'Sort by Rating' }
                  ].map((option) => {
                    const isActive = sortBy === option.id; 
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSortBy(option.id)}
                        className={`px-4 py-1.5 text-xs sm:text-sm font-bold tracking-wide rounded-full transition-all duration-300 border ${
                          isActive
                            ? 'bg-[#004D40] text-white border-[#004D40] shadow-sm'
                            : 'bg-transparent text-[#1A332E] border-[#EBE9E0] hover:border-[#9E7D3B] hover:text-[#9E7D3B]'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rating Section */}
              <div className="flex items-center justify-between sm:justify-start gap-2 sm:pl-3">
                <span className="text-[#8C8275] font-bold tracking-wider text-xs sm:text-sm uppercase whitespace-nowrap">Rating:</span>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="bg-transparent text-[#1A332E] font-medium py-1 px-2 mx-1 transition-colors duration-200 focus:outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239E7D3B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_auto] bg-[right_4px_center] bg-no-repeat pr-6 text-xs sm:text-sm"
                >
                  <option value={0}>All Ratings</option>
                  <option value={5}>⭐ 5 Stars</option>
                  <option value={4}>⭐ 4 & Up</option>
                  <option value={3}>⭐ 3 & Up</option>
                  <option value={2}>⭐ 2 & Up</option>
                  <option value={1}>⭐ 1 & Up</option>
                </select>
              </div>

            </div>
          </div>
        </div>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[45vh] space-y-4">
            <Loader2 className="w-12 h-12 text-[#004225] animate-spin" />
            <p className="text-sm text-stone-500 font-medium tracking-widest uppercase">Unveiling our collections...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center min-h-[45vh] space-y-4 text-center">
            <p className="text-stone-600 font-medium">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 border border-[#004225] text-[#004225] hover:bg-[#004225] hover:text-white transition-colors duration-300 uppercase tracking-widest text-xs font-bold"
            >
              Reload Collection
            </button>
          </div>
        ) : (
          <>
            {/* Active filter title & count */}
            <div className="flex items-center justify-between mb-8 pb-3 border-b border-stone-200/50">
              <div>
                <h2 className="text-lg md:text-xl font-serif font-bold text-stone-900 tracking-wide">
                  {selectedFilter === 'All' ? 'Complete Catalog' : selectedFilter}
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">Showing {processedProducts.length} exclusive designer items</p>
              </div>
            </div>

            {processedProducts.length === 0 ? (
              <div className="text-center py-24 bg-stone-50/50 border border-stone-100 rounded-lg">
                <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500 font-serif text-base italic">No sarees match your search or filter selections</p>
                <button 
                  onClick={() => { setSelectedFilter('All'); setSearchQuery(''); }}
                  className="mt-4 text-xs font-bold text-[#004225] hover:text-[#D4AF37] underline tracking-widest uppercase transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              /* 3. Database Setup & Responsive Product Grid */
              <div key={selectedFilter} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 p-2">
                {processedProducts && processedProducts.map((product) => {
                  const uniqueLayoutKey = `${product.id || product.name}-${product.price}`;
                  const saree = product;
                  const displayPrice = getProductPrice(saree);
                  const productReviews = reviews.filter(r => r.product_id === saree.id.toString());
                  const reviewCount = productReviews.length;
                  const averageRating = reviewCount > 0 
                    ? (productReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
                    : null;

                  return (
                    <div 
                      key={uniqueLayoutKey} 
                      className="group flex flex-col bg-white overflow-hidden border border-stone-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 rounded-sm relative"
                    >
                      {/* Wishlist Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const isFavorited = wishlist.some(item => item.id === saree.id);
                          if (isFavorited) {
                            setWishlist(wishlist.filter(item => item.id !== saree.id));
                          } else {
                            setWishlist([...wishlist, saree]);
                          }
                        }}
                        className="absolute top-3 right-3 z-30 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:scale-110 transition-transform"
                      >
                        <Heart 
                          className={`w-4.5 h-4.5 transition-colors ${
                            wishlist.some(item => item.id === saree.id)
                              ? 'text-[#E11D48] fill-[#E11D48]'
                              : 'text-stone-600 hover:text-[#E11D48]'
                          }`}
                        />
                      </button>

                      {/* Product Badge / Sold Out Badge */}
                      {saree.is_out_of_stock ? (
                        <div className="absolute top-3 left-3 z-20">
                          <span className="bg-red-650 text-white text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 shadow-md shadow-black/10 rounded-sm">
                            SOLD OUT
                          </span>
                        </div>
                      ) : saree.badge ? (
                        <div className="absolute top-3 left-3 z-20">
                          <span className="bg-[#D4AF37] text-white text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 shadow-md shadow-black/10 rounded-sm">
                            {saree.badge}
                          </span>
                        </div>
                      ) : null}

                      {/* Image Container with hover transition */}
                      <div 
                        className="aspect-[3/4] w-full overflow-hidden bg-gray-100 rounded-md cursor-pointer relative"
                        onClick={() => openModal(saree)}
                      >
                        <img 
                          src={saree.image_url} 
                          alt={saree.name}
                          className={`w-full h-full object-cover object-center group-hover:scale-[1.04] transition-transform duration-700 ease-out ${saree.is_out_of_stock ? 'blur-[3px] opacity-60' : ''}`}
                          loading="lazy"
                        />
                        {saree.is_out_of_stock ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10">
                            <span className="bg-stone-900/95 text-[#FDFBF7] text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2.5 border border-stone-800 shadow-md rounded-sm">
                              SOLD OUT
                            </span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-[#004225]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
                            <span className="w-full bg-white/95 text-stone-900 text-center p-4 text-lg font-bold tracking-normal uppercase shadow-md transition-transform duration-500 translate-y-3 group-hover:translate-y-0">
                              Quick View
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Product Content */}
                      <div className="p-3 sm:p-5 flex flex-col flex-grow items-center text-center bg-white">
                        <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-stone-400 mb-1">
                          {saree.collection_type || 'Boutique Special'}
                        </span>
                        <h3 className="text-xs sm:text-sm font-semibold truncate mt-1 text-stone-950 uppercase tracking-wider mb-1 w-full text-center">
                          {saree.name}
                        </h3>
                        {averageRating && (
                           <div className="text-[10px] text-stone-500 font-sans flex items-center justify-center space-x-1 mb-2">
                             <span>⭐</span>
                             <span className="font-bold text-stone-700">{averageRating}</span>
                             <span className="text-stone-400">({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</span>
                           </div>
                         )}
                        <p className="text-xs sm:text-sm text-gray-900 font-bold mb-3 sm:mb-4">
                          ₹{displayPrice}
                        </p>
                        
                        <div className="mt-auto w-full flex flex-col sm:flex-row gap-2 sm:space-x-2 sm:gap-0">
                          <button 
                            onClick={() => {
                              if (!saree.is_out_of_stock) {
                                openModal(saree);
                              }
                            }}
                            disabled={saree.is_out_of_stock}
                            className={`flex-1 tracking-wide uppercase text-xs md:text-sm font-bold py-2 px-3 flex items-center justify-center space-x-1 transition-colors duration-300 rounded-sm ${
                              saree.is_out_of_stock 
                                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                : 'bg-[#D4AF37] hover:bg-[#c29e2f] text-white'
                            }`}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>{saree.is_out_of_stock ? 'SOLD OUT' : 'Buy Now'}</span>
                          </button>

                          <button 
                            onClick={() => handleAddToBag(saree)}
                            disabled={saree.is_out_of_stock}
                            className={`flex-1 tracking-wide uppercase text-xs md:text-sm font-bold py-2 px-3 flex items-center justify-center space-x-1 transition-colors duration-300 rounded-sm ${
                              saree.is_out_of_stock 
                                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                : 'bg-stone-900 hover:bg-stone-850 text-white'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to Bag</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* 4. Custom Checkout & Modal Logic */}
      {selectedSaree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white max-w-3xl w-full flex flex-col md:flex-row overflow-hidden rounded-sm relative shadow-2xl text-left max-h-[92vh] border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button 
              onClick={() => setSelectedSaree(null)}
              className="absolute top-4 right-4 p-2 bg-white/95 hover:bg-stone-100 rounded-full z-30 transition-colors border border-stone-100 shadow-sm"
            >
              <X className="w-4 h-4 text-stone-900" />
            </button>

            {/* Left Column: Image */}
            <div className="w-full md:w-1/2 h-[320px] md:h-[500px] bg-stone-50 shrink-0 relative">
              <img 
                src={selectedSaree.image_url} 
                alt={selectedSaree.name} 
                className={`w-full h-full object-cover ${selectedSaree.is_out_of_stock ? 'blur-[3px] opacity-60' : ''}`}
              />
              {selectedSaree.is_out_of_stock ? (
                <span className="absolute top-4 left-4 bg-red-600 text-white text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 shadow-md">
                  SOLD OUT
                </span>
              ) : selectedSaree.badge ? (
                <span className="absolute top-4 left-4 bg-[#D4AF37] text-white text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 shadow-md">
                  {selectedSaree.badge}
                </span>
              ) : null}
              {selectedSaree.is_out_of_stock && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <span className="bg-stone-900/95 text-[#FDFBF7] text-xs font-bold tracking-[0.2em] uppercase px-5 py-3 border border-stone-800 shadow-xl rounded-sm">
                    SOLD OUT
                  </span>
                </div>
              )}
            </div>

            {/* Right Column: Checkout details */}
            <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto bg-[#FDFDFB]">
              <div>
                <span className="text-base font-bold tracking-widest text-slate-900 uppercase mb-2 block">
                  {selectedSaree.collection_type || 'Exclusive Design'}
                </span>
                <h2 className="text-xl md:text-2xl font-serif font-bold tracking-wide uppercase mb-3 text-stone-900 pr-6 leading-tight">
                  {selectedSaree.name}
                </h2>
                
                {/* Dynamically calculated display price */}
                <div className="flex items-baseline space-x-2.5 mb-6">
                  {selectedSaree.collection_type === 'Bagru Block Prints' && addPompom && (
                    <span className="text-slate-400 line-through text-sm font-sans font-bold tracking-tight">₹900</span>
                  )}
                  <span className="text-slate-900 font-sans text-2xl md:text-3xl font-bold tracking-tight">
                    ₹{getProductPrice(selectedSaree, addPompom)}
                  </span>
                </div>

                {/* Specific descriptions and customized checkout selections */}
                <div className="space-y-5 border-t border-stone-200/80 pt-5 mb-6">
                  
                  {/* Avaasa Cordsets Details & Selection */}
                  {selectedSaree.collection_type === 'Avaasa Cordsets' && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-sm font-extrabold tracking-wider text-slate-950 uppercase block">Fabric Specification</span>
                        <p className="text-slate-800 text-base font-semibold leading-relaxed bg-[#FDFBF7] p-2.5 border border-[#D4AF37]/15 rounded-sm">
                          Fabric: Imported Vertican Linen-Based Fabric
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-sm font-extrabold tracking-wider text-slate-950 uppercase block">Select Size (M to XXL)</span>
                        <div className="flex gap-2.5">
                          {['M', 'L', 'XL', 'XXL'].map((size) => (
                            <button
                              key={size}
                              onClick={() => setSelectedSize(size)}
                              className={`w-11 h-11 text-xs font-bold rounded-sm border flex items-center justify-center transition-all ${
                                selectedSize === size
                                  ? 'bg-[#004225] border-[#004225] text-white shadow-sm'
                                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bagru Block Prints Details & Selection */}
                  {selectedSaree.collection_type === 'Bagru Block Prints' && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-sm font-extrabold tracking-wider text-slate-950 uppercase block">Fabric Specification</span>
                        <p className="text-slate-800 text-base font-semibold leading-relaxed bg-[#FDFBF7] p-2.5 border border-[#D4AF37]/15 rounded-sm">
                          Fabric: Pure Mulmul (92*80) Cotton
                        </p>
                      </div>
                      
                      {/* Pompom Add-on Checkbox */}
                      <label className="flex items-center space-x-3 cursor-pointer p-3 bg-stone-50 border border-stone-200/60 rounded-sm hover:bg-stone-100/70 transition-colors">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={addPompom} 
                            onChange={(e) => setAddPompom(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 border rounded-sm flex items-center justify-center transition-colors ${
                            addPompom ? 'bg-[#004225] border-[#004225]' : 'bg-white border-stone-300'
                          }`}>
                            {addPompom && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-stone-700 tracking-wide uppercase">
                          Add Pompom (+₹50)
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Standard / Narayanpet Details */}
                  {selectedSaree.collection_type === 'Narayanpet' && (
                    <div className="space-y-1">
                      <span className="text-sm font-extrabold tracking-wider text-slate-950 uppercase block">Fabric Specification</span>
                      <p className="text-base font-semibold text-slate-800 leading-relaxed">
                        100% Pure Soft Cotton (2/100s count) featuring our signature traditional temple border and a classic striped pallu.
                      </p>
                    </div>
                  )}

                  {/* Generic Description if available */}
                  {selectedSaree.description && (
                    <div className="space-y-1">
                      <span className="text-sm font-extrabold tracking-wider text-slate-950 uppercase block">About This piece</span>
                      <p className="text-base font-semibold text-slate-800 leading-relaxed">
                        {selectedSaree.description}
                      </p>
                    </div>
                  )}

                  {/* Customer Feedback Sub-panel */}
                  <div className="border-t border-stone-200/80 pt-5 mt-5">
                    <span className="text-sm font-extrabold tracking-wider text-slate-950 uppercase block mb-3">Customer Reviews</span>
                    
                    {/* Reviews List */}
                    <div className="space-y-3 mb-6 max-h-[200px] overflow-y-auto pr-1">
                      {reviews.filter(r => r.product_id === selectedSaree.id.toString()).length === 0 ? (
                        <p className="text-xs text-stone-400 italic">No reviews yet. Be the first to review!</p>
                      ) : (
                        reviews
                          .filter(r => r.product_id === selectedSaree.id.toString())
                          .map((rev) => (
                            <div key={rev.id} className="p-3 bg-stone-50 border border-stone-200/60 rounded-sm">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-stone-850">{rev.reviewer_name}</span>
                                <span className="text-[10px] text-[#D4AF37]">
                                  {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                                </span>
                              </div>
                              <p className="text-stone-600 text-xs leading-relaxed">{rev.comment}</p>
                            </div>
                          ))
                      )}
                    </div>

                    {/* Leave a Review Form */}
                    <form onSubmit={handleAddReview} className="space-y-3 bg-[#FDFBF7] p-3 border border-[#D4AF37]/15 rounded-sm">
                      <span className="text-sm font-extrabold tracking-wider text-slate-950 uppercase block">Leave a Review</span>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <input
                            type="text"
                            required
                            placeholder="Your Name"
                            value={reviewerName}
                            onChange={(e) => setReviewerName(e.target.value)}
                            className="w-full text-xs p-2 bg-white border border-stone-250 rounded-sm focus:outline-none focus:border-[#004225]"
                          />
                        </div>
                        <div>
                          <select
                            value={reviewRating}
                            onChange={(e) => setReviewRating(Number(e.target.value))}
                            className="w-full text-xs p-2 bg-white border border-stone-250 rounded-sm focus:outline-none focus:border-[#004225] cursor-pointer"
                          >
                            <option value={5}>5 Stars</option>
                            <option value={4}>4 Stars</option>
                            <option value={3}>3 Stars</option>
                            <option value={2}>2 Stars</option>
                            <option value={1}>1 Star</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <textarea
                          required
                          rows={2}
                          placeholder="Write your review comments here..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-stone-250 rounded-sm focus:outline-none focus:border-[#004225] resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="w-full bg-[#004225] hover:bg-[#005c34] text-white tracking-wide uppercase text-sm font-bold py-2.5 px-4 transition-colors rounded-sm shadow-sm"
                      >
                        {isSubmittingReview ? "Submitting..." : "Submit Review"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:space-x-3 sm:gap-0 w-full">
                {/* Gold "BUY NOW" Trigger */}
                <button 
                  onClick={() => { 
                    if (!selectedSaree.is_out_of_stock) {
                      handleBuyNow(selectedSaree, selectedSize, addPompom); 
                      setSelectedSaree(null); 
                    }
                  }}
                  disabled={selectedSaree.is_out_of_stock}
                  className={`flex-1 tracking-wide uppercase text-sm font-extrabold py-2.5 px-5 flex items-center justify-center space-x-2 transition-colors shadow-md rounded-sm ${
                    selectedSaree.is_out_of_stock 
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                      : 'bg-[#D4AF37] hover:bg-[#c29e2f] text-white'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Buy Now</span>
                </button>

                {/* Add to Bag Trigger */}
                <button 
                  onClick={() => { 
                    if (!selectedSaree.is_out_of_stock) {
                      handleAddToBag(selectedSaree, selectedSize, addPompom); 
                      setSelectedSaree(null); 
                    }
                  }}
                  disabled={selectedSaree.is_out_of_stock}
                  className={`flex-1 tracking-wide uppercase text-sm font-extrabold py-2.5 px-5 flex items-center justify-center space-x-2 transition-colors shadow-md rounded-sm ${
                    selectedSaree.is_out_of_stock 
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                      : 'bg-stone-900 hover:bg-stone-850 text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Bag</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Footer Design */}
      <footer className="bg-stone-950 text-stone-400 py-16 border-t border-stone-900 mt-20">
        <div className="max-w-4xl mx-auto px-4 text-center divide-y divide-stone-900">
          <div className="pb-10">
            <h2 className="text-[#D4AF37] font-serif text-2xl tracking-widest mb-4">Artisanal Craftsmanship</h2>
            <p className="text-stone-400 max-w-2xl mx-auto leading-relaxed text-xs md:text-sm font-light">
              SHAHI'S BOUTIQUE celebrates traditional weave patterns, hand block print techniques, and premium modern silhouettes. Each piece is curated to offer unparalleled luxury, styling comfort, and heritage elegance.
            </p>
          </div>
          <div className="pt-10">
            <h3 className="text-[10px] uppercase tracking-[0.25em] text-stone-500 mb-6">Shipping Details</h3>
            <div className="inline-flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-8 text-xs font-semibold uppercase tracking-wider">
              <div className="flex items-center">
                <span className="text-[#D4AF37] mr-2.5 text-lg">•</span>
                <span>Tamil Nadu Shipping: <strong className="text-white ml-1">₹50</strong></span>
              </div>
              <div className="hidden md:block text-stone-850">|</div>
              <div className="flex items-center">
                <span className="text-[#D4AF37] mr-2.5 text-lg">•</span>
                <span>Rest of India: <strong className="text-white ml-1">₹100</strong></span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-[10px] text-stone-600 mt-16 tracking-widest uppercase flex flex-col items-center space-y-4">
          <p>© {new Date().getFullYear()} Shahi's Boutique. All Rights Reserved.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-2">
            <Link to="/admin" className="hover:text-white transition-colors flex items-center group text-base md:text-lg font-semibold text-slate-800">
               Admin Dashboard <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
            </Link>
            <span className="text-xs md:text-sm font-medium text-slate-600 ml-3 normal-case tracking-normal">Support: +91 97860 88969</span>
          </div>
        </div>
      </footer>

      {/* 5. Wishlist Drawer */}
      {isWishlistOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => setIsWishlistOpen(false)} />
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-[#FDFBF7]">
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-[#E11D48] fill-[#E11D48]" />
                <h3 className="font-serif text-lg font-bold uppercase tracking-wider text-stone-900">Your Wishlist</h3>
              </div>
              <button 
                onClick={() => setIsWishlistOpen(false)}
                className="p-1 hover:bg-stone-100 rounded-full transition-colors border border-stone-200"
              >
                <X className="w-4 h-4 text-stone-900" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              {wishlist.length === 0 ? (
                <div className="text-center py-20 text-stone-400 flex flex-col items-center">
                  <Heart className="w-8 h-8 text-stone-200 mb-3" />
                  <p className="text-xs uppercase tracking-widest">Your wishlist is empty.</p>
                </div>
              ) : (
                wishlist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200/50 rounded-sm">
                    <div className="flex items-center space-x-3">
                      <img src={item.image_url} alt={item.name} className="w-14 h-14 object-cover rounded-sm border border-stone-200" />
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 line-clamp-1">{item.name}</h4>
                        <p className="text-[10px] text-slate-900 font-sans font-bold tracking-tight mt-0.5">₹{getProductPrice(item)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          handleAddToBag(item);
                          setWishlist(wishlist.filter(w => w.id !== item.id));
                        }}
                        disabled={item.is_out_of_stock}
                        className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-sm transition-colors ${
                          item.is_out_of_stock 
                            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                            : 'bg-[#D4AF37] hover:bg-[#c29e2f] text-white'
                        }`}
                      >
                        Add to Bag
                      </button>
                      <button
                        onClick={() => setWishlist(wishlist.filter(w => w.id !== item.id))}
                        className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => { setIsCartOpen(false); setCheckoutStage('cart'); setSelectedCheckoutItems(null); }} />
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-[#FDFBF7]">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-[#004225]" />
                <h3 className="font-serif text-lg font-bold uppercase tracking-wider text-stone-900">
                  {checkoutStage === 'cart' ? 'Your Cart Bag' : 'Delivery details'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsCartOpen(false); setCheckoutStage('cart'); setSelectedCheckoutItems(null); }}
                className="p-1 hover:bg-stone-100 rounded-full transition-colors border border-stone-200"
              >
                <X className="w-4 h-4 text-stone-900" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              {checkoutStage === 'cart' ? (
                cart.length === 0 ? (
                  <div className="text-center py-20 text-stone-400 flex flex-col items-center">
                    <ShoppingBag className="w-8 h-8 text-stone-200 mb-3" />
                    <p className="text-xs uppercase tracking-widest">Your cart bag is empty.</p>
                  </div>
                ) : (
                  cart.map((item) => {
                    const finalPrice = getProductPrice(item.product, item.pompomOption);
                    return (
                      <div key={item.id} className="flex items-start justify-between p-3 bg-stone-50 border border-stone-200/50 rounded-sm">
                        <div className="flex items-center space-x-3">
                          <img src={item.product.image_url} alt={item.product.name} className="w-14 h-14 object-cover rounded-sm border border-stone-200" />
                          <div>
                            <h4 className="text-xs font-bold text-stone-900 line-clamp-1">{item.product.name}</h4>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.sizeOption && (
                                <span className="bg-stone-200 text-stone-700 text-[8px] font-bold px-1 py-0.5 rounded">Size: {item.sizeOption}</span>
                              )}
                              {item.pompomOption && (
                                <span className="bg-[#D4AF37]/25 text-[#735914] text-[8px] font-bold px-1 py-0.5 rounded">Pompom (+₹50)</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-900 font-sans font-bold tracking-tight mt-1">₹{finalPrice * item.quantity}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <div className="flex items-center border border-stone-300 rounded overflow-hidden">
                            <button
                              onClick={() => {
                                if (item.quantity > 1) {
                                  setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity - 1 } : c));
                                } else {
                                  setCart(cart.filter(c => c.id !== item.id));
                                }
                              }}
                              className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-xs font-bold transition-colors"
                            >
                              -
                            </button>
                            <span className="px-2.5 py-0.5 text-xs font-semibold bg-white">{item.quantity}</span>
                            <button
                              onClick={() => {
                                      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
                              }}
                              className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-xs font-bold transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => setCart(cart.filter(c => c.id !== item.id))}
                            className="text-[10px] font-semibold text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                /* Delivery Capture Form */
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-stone-400 block mb-2 font-sans">Shipping Details</span>
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1 font-sans">Customer Name *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Priyanth"
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1 font-sans">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1 font-sans">Shipping Address *</label>
                    <textarea
                      required
                      rows={3}
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="e.g. Door No, Street Name, City, State"
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm resize-none font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1 font-sans">Pincode *</label>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="e.g. 600001"
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm font-sans"
                    />
                  </div>
                </form>
              )}
            </div>

            {checkoutItemsList.length > 0 && (
              <div className="p-6 border-t border-stone-200 bg-[#FDFBF7] space-y-4">
                {checkoutStage === 'shipping' && (
                  <div className="space-y-2 border-b border-stone-200 pb-4 text-xs font-sans text-stone-600">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-bold tracking-tight text-slate-900 font-sans">₹{checkoutSubtotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping Fee:</span>
                      <span className="font-bold tracking-tight text-slate-900 font-sans">₹60</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-stone-900 pt-1">
                      <span>Grand Total:</span>
                      <span className="text-slate-900 font-sans font-bold tracking-tight text-base">₹{grandTotal}</span>
                    </div>
                  </div>
                )}
                {checkoutStage === 'payment-submitted' ? (
                  <div className="space-y-4">
                    <div className="bg-[#004225]/10 border border-[#004225]/30 text-[#004225] p-4 rounded text-xs font-semibold leading-relaxed">
                      🎉 Order placed successfully! We have opened the Razorpay payment page in a new tab. Please complete your payment there.
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1.5 font-sans">
                        Razorpay Payment ID / Transaction Ref
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. pay_Nxxxxx or Txn ID"
                        value={tempPaymentId}
                        onChange={(e) => setTempPaymentId(e.target.value)}
                        className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm font-sans"
                      />
                    </div>
                    <button
                      onClick={handleSubmitPaymentId}
                      className="w-full bg-[#004225] hover:bg-[#005c34] text-white py-3 px-6 rounded-sm uppercase tracking-widest text-xs font-bold transition-colors shadow-md"
                    >
                      Submit for Verification
                    </button>
                    <button
                      onClick={() => {
                        setCart([]);
                        setIsCartOpen(false);
                        setCheckoutStage('cart');
                        setTempPaymentId('');
                        setLatestOrderId(null);
                      }}
                      className="w-full text-center text-[10px] text-stone-400 hover:text-stone-600 uppercase tracking-wider pt-2"
                    >
                      Skip & Clear Cart
                    </button>
                  </div>
                ) : checkoutStage === 'cart' ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm font-bold uppercase tracking-wider text-stone-900">
                      <span>Subtotal:</span>
                      <span className="text-slate-900 font-sans font-bold tracking-tight text-lg">₹{cartSubtotal}</span>
                    </div>
                    <button
                      onClick={() => setCheckoutStage('shipping')}
                      className="w-full bg-[#004225] hover:bg-[#005c34] text-white py-3.5 px-6 rounded-sm uppercase tracking-widest text-xs font-bold transition-colors shadow-md border border-[#D4AF37]/35 flex items-center justify-center space-x-2"
                    >
                      <span>PROCEED TO CHECKOUT</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => handleProceedToPayment()}
                      className="w-full bg-[#004225] hover:bg-[#005c34] text-white py-3.5 px-6 rounded-sm uppercase tracking-widest text-xs font-bold transition-colors shadow-md border border-[#D4AF37]/35 flex items-center justify-center space-x-2"
                    >
                      <span>Proceed to Secure Payment</span>
                    </button>
                    

                    <button
                      onClick={() => {
                        setCheckoutStage('cart');
                        setSelectedCheckoutItems(null);
                      }}
                      className="w-full text-center text-[10px] text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-wider block pt-2"
                    >
                      ← Back to Cart
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. My Orders Drawer */}
      {isMyOrdersOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => setIsMyOrdersOpen(false)} />
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-[#FDFBF7]">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-[#004225]" />
                <h3 className="font-serif text-lg font-bold uppercase tracking-wider text-stone-900">Track My Orders</h3>
              </div>
              <button 
                onClick={() => setIsMyOrdersOpen(false)}
                className="p-1 hover:bg-stone-100 rounded-full transition-colors border border-stone-200"
              >
                <X className="w-4 h-4 text-stone-900" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              <div className="w-full flex items-center gap-2 mb-6">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={customerPhoneQuery || ''}
                    onChange={(e) => setCustomerPhoneQuery(e.target.value)}
                    placeholder="Enter Phone Number"
                    className="w-full px-4 py-2.5 bg-white border border-[#EBE9E0] rounded-lg text-sm text-[#1A332E] focus:outline-none focus:border-[#004D40]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDirectSearch}
                  className="px-6 py-2.5 bg-[#004D40] text-white font-bold text-sm rounded-lg uppercase tracking-wider hover:bg-[#00332a] transition-colors"
                >
                  {isFetchingOrders ? 'Searching...' : 'Search'}
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {customerOrders && customerOrders.length > 0 ? (
                  customerOrders.map((order, index) => {
                    // Self-contained safety block for every individual order card
                    try {
                      // Safely parse items if stringified
                      let parsedItems = [];
                      const itemsSource = order.saree_name || (order as any).items;
                      if (order && itemsSource) {
                        parsedItems = typeof itemsSource === 'string' ? JSON.parse(itemsSource) : itemsSource;
                      }
                      if (!Array.isArray(parsedItems)) parsedItems = [];

                      return (
                        <div key={order.id || index} className="p-4 bg-white border border-[#EBE9E0] rounded-xl shadow-xs">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-3 text-xs">
                            <span className="font-bold text-[#1A332E]">Order #{String(order.id || index).substring(0, 8).toUpperCase()}</span>
                            <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-md font-semibold capitalize">
                              {order.status || 'Pending'}
                            </span>
                          </div>

                          {/* Render safe item rows */}
                          <div className="space-y-1">
                            {parsedItems.map((item: any, idx: number) => (
                              <div key={idx} className="text-xs text-gray-700 flex justify-between">
                                <span>{item?.product?.name || item?.name || "Premium Boutique Selection"} <span className="text-gray-400">x{item?.quantity || 1}</span></span>
                                <span className="font-semibold">₹{item?.product?.price || item?.price || '0'}</span>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between text-xs font-bold text-[#1A332E]">
                            <span>Total:</span>
                            <span>₹{order.price || (order as any).total_price || (order as any).total || '0'}</span>
                          </div>

                          {order.payment_status === 'Unpaid' && (
                            <div className="flex flex-col space-y-2 w-full mt-3 pt-2 border-t border-gray-50">
                              <button
                                type="button"
                                onClick={() => window.open('https://razorpay.me/@chithambarampillainagarathina', '_blank')}
                                className="w-full bg-[#D4AF37] hover:bg-[#c29e2f] text-white text-[10px] py-1.5 uppercase font-bold tracking-wider rounded-sm transition-colors"
                              >
                                Complete Payment
                              </button>
                              
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  placeholder="Paste Razorpay Payment ID here"
                                  value={portalPaymentId[order.id] || ''}
                                  onChange={(e) => setPortalPaymentId({ ...portalPaymentId, [order.id]: e.target.value })}
                                  className="w-full text-[10px] p-1.5 bg-white border border-stone-200 rounded-sm focus:outline-none focus:border-[#004225]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSubmitPortalPaymentId(order.id)}
                                  className="w-full bg-[#004225] hover:bg-[#005c34] text-white text-[9px] py-1 uppercase font-bold tracking-wider rounded-sm transition-colors"
                                >
                                  Submit Payment ID
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    } catch (renderError) {
                      console.error("Individual order card failed to render safely:", renderError);
                      return (
                        <div key={index} className="p-3 bg-red-50 text-red-700 text-xs rounded-lg">
                          ⚠️ Error displaying this specific order summary sequence.
                        </div>
                      );
                    }
                  })
                ) : (
                  /* Safe fallback display when array is completely empty */
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-500">No active orders linked to this profile.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [sarees, setSarees] = useState<ExtendedSaree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  const [newSaree, setNewSaree] = useState({
    name: '',
    price: '',
    description: '',
    image_url: '',
    collection_type: 'Avaasa Cordsets'
  });
  const [customCollectionName, setCustomCollectionName] = useState('');
  const [isAddingSaree, setIsAddingSaree] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'management' | 'analytics'>('management');

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (orderError) throw orderError;
        if (orderData) setOrders(orderData as Order[]);

        const { data: sareeData, error: sareeError } = await supabase
          .from('sarees')
          .select('*')
          .order('id', { ascending: true });

        if (sareeError) throw sareeError;
        if (sareeData) setSarees(sareeData as ExtendedSaree[]);
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === 'SHAHI2026') {
      setIsAuthenticated(true);
      setPinError(null);
    } else {
      setPinInput('');
      setPinError('Invalid access PIN. Please try again.');
    }
  };

  const handleUpdateStatus = async (orderId: string) => {
    const previousOrders = [...orders];
    // Optimistically update status
    setOrders(orders.map(order => order.id === orderId ? { ...order, status: 'Shipped' } : order));

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'Shipped' })
        .eq('id', orderId);

      if (error) throw error;
    } catch (err: any) {
      console.error("Error updating order status:", err);
      // Revert state
      setOrders(previousOrders);
      alert("Failed to update status. Please try again.");
    }
  };

  const handleApprovePayment = async (orderId: string) => {
    const previousOrders = [...orders];
    setOrders(orders.map(order => 
      order.id === orderId 
        ? { ...order, payment_status: 'Paid', status: 'Pending' } 
        : order
    ));

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'Paid',
          status: 'Pending'
        })
        .eq('id', orderId);

      if (error) throw error;
      alert("Payment approved successfully!");
    } catch (err: any) {
      console.error("Error approving payment:", err);
      setOrders(previousOrders);
      alert("Failed to approve payment.");
    }
  };

  const handleToggleStockStatus = async (productId: string, category: string, currentStatus: boolean) => {
    const previousSarees = [...sarees];

    // Optimistically update stock status
    setSarees(sarees.map(s => 
      (s.id === productId && (s.category || s.collection || s.collection_type || 'item') === category) 
        ? { ...s, is_out_of_stock: !currentStatus } 
        : s
    ));

    try {
      const { error } = await supabase
        .from('sarees')
        .update({ is_out_of_stock: !currentStatus })
        .eq('id', productId);

      if (error) throw error;
    } catch (err: any) {
      console.error("Error updating stock status:", err);
      // Revert state
      setSarees(previousSarees);
      alert("Failed to update stock status. Please try again.");
    }
  };

  const handleDeleteSaree = async (itemId: string) => {
    if (window.confirm('Are you sure you want to completely remove this product?')) {
      try {
        const { error } = await supabase
          .from('sarees')
          .delete()
          .eq('id', itemId);

        if (error) throw error;

        setSarees(sarees.filter(s => s.id !== itemId));
      } catch (err: any) {
        console.error("Error deleting product:", err);
        alert("Failed to delete product. Please try again.");
      }
    }
  };

  const handleAddSaree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSaree.name || !newSaree.price || !newSaree.image_url) {
      alert("Please fill out name, price, and image URL.");
      return;
    }

    const finalCollectionType = newSaree.collection_type === 'new_collection'
      ? customCollectionName.trim()
      : newSaree.collection_type;

    if (!finalCollectionType) {
      alert("Please select or enter a valid collection name.");
      return;
    }

    setIsAddingSaree(true);
    try {
      const { name, price, description, image_url } = newSaree;
      const { data, error } = await supabase
        .from('sarees')
        .insert([{
          name,
          price: parseInt(price),
          description: description || null,
          image_url,
          collection_type: finalCollectionType
        }])
        .select();

      if (error) {
        console.error(error);
        alert("Failed to add product.");
        return;
      }

      if (data && data[0]) {
        setSarees([...sarees, data[0] as ExtendedSaree]);
      } else {
        // Fallback refresh
        const { data: refreshed } = await supabase
          .from('sarees')
          .select('*')
          .order('id', { ascending: true });
        if (refreshed) setSarees(refreshed as ExtendedSaree[]);
      }

      // Reset form
      setNewSaree({
        name: '',
        price: '',
        description: '',
        image_url: '',
        collection_type: 'Avaasa Cordsets'
      });
      setCustomCollectionName('');
      alert("Product added successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to add product.");
    } finally {
      setIsAddingSaree(false);
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    };
    return new Intl.DateTimeFormat('en-US', options).format(new Date(dateString));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-gradient-to-b from-[#004225]/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-[#D4AF37]/10 bg-[#D4AF37]/5 shadow-[0_0_120px_rgba(212,175,55,0.1)] blur-xl pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-md bg-stone-950/80 border border-stone-800/80 rounded-lg p-8 shadow-2xl backdrop-blur-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-[#004225]/40 border border-[#D4AF37]/30 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h2 className="text-2xl font-serif tracking-[0.2em] text-[#D4AF37] uppercase">SHAHI'S BOUTIQUE</h2>
            <p className="text-xs text-stone-500 tracking-widest uppercase mt-2">Administration Lock Screen</p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold tracking-widest uppercase text-stone-400 mb-2">
                Enter Entry PIN
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••••••"
                className="w-full text-center tracking-widest text-lg py-3 bg-stone-900/60 border border-stone-800 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 rounded-md text-white placeholder-stone-750 transition-all"
              />
              {pinError && (
                <p className="mt-2 text-xs text-red-500 text-center font-medium">
                  {pinError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-[#004225] hover:bg-[#005c34] text-[#FDFBF7] tracking-widest uppercase text-xs font-bold py-3.5 transition-colors duration-300 rounded-md border border-[#D4AF37]/20 shadow-md shadow-[#004225]/15"
            >
              Verify PIN
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link to="/" className="text-xs text-stone-500 hover:text-stone-300 transition-colors uppercase tracking-widest font-bold inline-flex items-center">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Return to Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredAdminProducts = sarees.filter(item => {
    const itemCategory = (item.category || item.collection || item.collection_type || 'item').toLowerCase();
    const query = adminSearchQuery.toLowerCase();
    return item.name.toLowerCase().includes(query) || itemCategory.includes(query);
  });

  // Business Insights calculations
  const paidOrders = orders.filter(o => o.payment_status !== 'Unpaid');
  const shippedOrders = paidOrders.filter(o => o.status === 'Shipped');
  const totalRevenue = shippedOrders.reduce((sum, o) => sum + o.price, 0);
  
  const totalOrdersCount = paidOrders.length;
  const pendingOrdersCount = paidOrders.filter(o => o.status !== 'Shipped').length;
  const shippedOrdersCount = shippedOrders.length;
  
  const collectionCounts: Record<string, number> = {};
  paidOrders.forEach(o => {
    const matchedSaree = sarees.find(s => o.saree_name.toLowerCase().includes(s.name.toLowerCase()));
    let colType = matchedSaree?.collection_type || '';
    if (!colType) {
      const colName = ['Avaasa Cordsets', 'Bagru Block Prints', 'Narayanpet'].find(
        c => o.saree_name.toLowerCase().includes(c.toLowerCase())
      );
      if (colName) colType = colName;
    }
    if (colType) {
      const stdCol = colType.toLowerCase() === 'narayanpet' ? 'Narayanpet Series' : colType;
      collectionCounts[stdCol] = (collectionCounts[stdCol] || 0) + 1;
    }
  });

  let topCollection = 'N/A';
  let maxCount = 0;
  Object.entries(collectionCounts).forEach(([col, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topCollection = col;
    }
  });

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 flex flex-col">
      {/* Admin Header */}
      <header className="bg-[#004225] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Package className="w-8 h-8 text-[#D4AF37]" />
            <h1 className="text-2xl font-serif tracking-widest uppercase">Merchant Dashboard</h1>
          </div>
          <div className="flex items-center space-x-6">
            <Link to="/admin/shipping" className="text-sm uppercase tracking-widest font-bold flex items-center hover:text-[#D4AF37] transition-colors">
              <Printer className="w-4 h-4 mr-2" />
              Shipping
            </Link>
            <Link to="/" className="text-sm uppercase tracking-widest font-bold flex items-center hover:text-[#D4AF37] transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Storefront
            </Link>
          </div>
        </div>
      </header>

      {/* Admin Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        
        {/* Tab Navigation */}
        <div className="flex border-b border-stone-250 mb-8">
          <button
            onClick={() => setActiveAdminTab('management')}
            className={`px-6 py-3 text-base md:text-lg font-bold uppercase tracking-wide border-b-2 transition-all ${
              activeAdminTab === 'management'
                ? 'border-[#004225] text-[#004225]'
                : 'border-transparent text-stone-500 hover:text-stone-850'
            }`}
          >
            📦 Order & Inventory Management
          </button>
          <button
            onClick={() => setActiveAdminTab('analytics')}
            className={`px-6 py-3 text-base md:text-lg font-bold uppercase tracking-wide border-b-2 transition-all ${
              activeAdminTab === 'analytics'
                ? 'border-[#004225] text-[#004225]'
                : 'border-transparent text-stone-500 hover:text-stone-850'
            }`}
          >
            📊 Business Insights
          </button>
        </div>

        {activeAdminTab === 'management' ? (
          <>
            <div className="mb-8">
               <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase mb-2">Order Management</h2>
               <p className="text-stone-500">Track and update customer orders dynamically.</p>
            </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 text-[#004225] animate-spin" />
            <p className="text-gray-600 tracking-wide">Loading Orders...</p>
          </div>
        ) : error ? (
           <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-sm">
             {error}
           </div>
        ) : orders.length === 0 ? (
           <div className="bg-white border border-stone-200 rounded-sm p-12 text-center text-stone-500">
             No orders found yet. When customers click "Buy Now", they will appear here.
           </div>
        ) : (
          <div className="bg-white shadow-sm border border-stone-200 overflow-hidden rounded-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-500">Order ID</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-stone-600 uppercase tracking-widest">
                      Item
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-stone-600 uppercase tracking-widest">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-stone-600 uppercase tracking-widest">
                      Date ordered
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-stone-600 uppercase tracking-widest">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-stone-600 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-200">
                  {orders.filter(order => order.payment_status !== 'Unpaid').map((order) => (
                    <tr key={order.id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-4 px-4 text-sm font-mono text-gray-600 font-semibold whitespace-nowrap">
                        #{order.id ? String(order.id).substring(0, 8).toUpperCase() : 'N/A'}
                      </td>
                      <td className="px-6 py-5">
                        {(() => {
                          try {
                            // Parse the stored JSON string safely
                            const items = JSON.parse(order.saree_name);
                            if (Array.isArray(items)) {
                              return (
                                <div className="flex flex-col gap-1 text-sm text-gray-750 font-medium">
                                  {items.map((item: any, idx: number) => {
                                    const product = item.product || item;
                                    return (
                                      <div key={idx} className="bg-gray-150 px-2 py-1 rounded border border-gray-250">
                                        👗 {product.name || 'Unknown Saree'} 
                                        <span className="text-gray-500 text-xs ml-2">(Qty: {item.quantity || 1})</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return <span className="text-sm">{String(order.saree_name)}</span>;
                          } catch (e) {
                            // Fallback if it's already a regular string
                            return <span className="text-sm text-gray-800">{order.saree_name || 'N/A'}</span>;
                          }
                        })()}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-base md:text-lg text-slate-700 font-sans font-bold tracking-tight">₹{order.price}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-base md:text-lg text-slate-700 flex items-center">
                           <Clock className="w-4 h-4 mr-2 text-stone-400" />
                           {formatDate(order.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${
                          order.status === 'Shipped' 
                             ? 'bg-green-100 text-green-800' 
                             : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status === 'Shipped' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {order.status}
                        </span>
                        <div className="mt-2">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm ${
                            String(order.payment_status || 'Paid').toLowerCase().includes('paid') 
                              ? 'bg-green-100 text-green-800 border border-green-300' 
                              : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                          }`}>
                            Payment: {order.payment_status || 'Paid'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        {order.payment_status?.includes('Awaiting Verification') && (
                          <button
                            onClick={() => handleApprovePayment(order.id)}
                            className="text-yellow-600 hover:text-white border border-yellow-600 hover:bg-yellow-600 px-4 py-2 text-xs uppercase tracking-widest font-bold transition-colors"
                          >
                            Approve Payment
                          </button>
                        )}
                        {order.status !== 'Shipped' && (
                           <button
                             onClick={() => handleUpdateStatus(order.id)}
                             className="text-[#004225] hover:text-white border border-[#004225] hover:bg-[#004225] px-4 py-2 text-xs uppercase tracking-widest font-bold transition-colors"
                           >
                             Mark Shipped
                           </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Product Inventory Section */}
        <div className="my-16 border-t border-stone-200/80" />

        <div className="mb-8">
           <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase mb-2">Product Inventory & Control</h2>
           <p className="text-stone-500">Manage boutique collection items, toggle stock statuses, and add new products.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
           {/* Left Column: Product List with Toggles */}
           <div className="bg-white border border-stone-200 rounded-sm p-6 shadow-sm">
             <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 mb-4 border-b pb-2">Inventory Stock Status</h3>
             
             {/* Search Bar */}
             <div className="mb-4 relative">
               <input
                 type="text"
                 placeholder="Search product name, category, or fabric detail..."
                 value={adminSearchQuery}
                 onChange={(e) => setAdminSearchQuery(e.target.value)}
                 className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/20 rounded-md transition-all bg-stone-50"
               />
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
               {adminSearchQuery && (
                 <button 
                   type="button"
                   onClick={() => setAdminSearchQuery('')}
                   className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-stone-200 rounded-full"
                 >
                   <X className="w-5 h-5 text-stone-500" />
                 </button>
               )}
             </div>

             <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
               {filteredAdminProducts.map((item, index) => (
                 <div key={`${item.category || item.collection || item.collection_type || 'item'}-${item.id || index}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-stone-50 hover:bg-stone-100/70 border border-stone-200/40 rounded-sm transition-colors gap-4">
                    <div className="flex items-center space-x-5">
                      <img src={item.image_url} alt={item.name} className="w-20 h-20 object-cover rounded-sm border border-stone-200" />
                      <div>
                        <h4 className="text-base md:text-lg text-slate-700 font-bold truncate max-w-[180px] sm:max-w-[280px]">{item.name}</h4>
                        <p className="text-sm text-stone-500 uppercase tracking-wider">{item.collection_type || 'Boutique Special'}</p>
                        <p className="text-lg md:text-xl text-slate-900 font-sans font-bold tracking-tight mt-1">₹{item.price}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 shrink-0">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${item.is_out_of_stock ? 'text-red-500' : 'text-green-600'}`}>
                          {item.is_out_of_stock ? 'Out of Stock' : 'In Stock'}
                        </span>
                        <button
                          onClick={() => handleToggleStockStatus(item.id, item.category || item.collection || item.collection_type || 'item', item.is_out_of_stock || false)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            item.is_out_of_stock ? 'bg-red-500' : 'bg-green-600'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              item.is_out_of_stock ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteSaree(item.id)}
                        title="Delete Product"
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 rounded transition-colors border border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                 </div>
               ))}
               {!loading && sarees.length === 0 && (
                 <p className="text-xs text-stone-500 italic text-center py-6">No products found.</p>
               )}
             </div>
           </div>

           {/* Right Column: Inline Form */}
           <div className="bg-white border border-stone-200 rounded-sm p-6 shadow-sm">
             <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 mb-4 border-b pb-2">Add New Product</h3>
             <form onSubmit={handleAddSaree} className="space-y-4">
               <div>
                 <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1">Product Name *</label>
                 <input
                   type="text"
                   required
                   value={newSaree.name}
                   onChange={(e) => setNewSaree({ ...newSaree, name: e.target.value })}
                   placeholder="e.g. Traditional Narayanpet Handloom Cotton Saree"
                   className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm"
                 />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1">Price (₹) *</label>
                   <input
                     type="number"
                     required
                     value={newSaree.price}
                     onChange={(e) => setNewSaree({ ...newSaree, price: e.target.value })}
                     placeholder="e.g. 950"
                     className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm"
                   />
                 </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1">Collection Type *</label>
                    <select
                      value={newSaree.collection_type}
                      onChange={(e) => setNewSaree({ ...newSaree, collection_type: e.target.value })}
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm"
                    >
                      {Array.from(new Set([
                        'Avaasa Cordsets',
                        'Bagru Block Prints',
                        'Narayanpet',
                        ...sarees.map(s => s.category || s.collection || s.collection_type).filter(Boolean)
                      ])).map((col) => (
                        <option key={col} value={col}>
                          {col === 'Narayanpet' ? 'Narayanpet Series' : col}
                        </option>
                      ))}
                      <option value="new_collection">+ Add New Collection...</option>
                    </select>
                  </div>
                </div>

                {newSaree.collection_type === 'new_collection' && (
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1">Enter New Collection Name *</label>
                    <input
                      type="text"
                      required
                      value={customCollectionName}
                      onChange={(e) => setCustomCollectionName(e.target.value)}
                      placeholder="e.g. Kanjivaram Silk"
                      className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm"
                    />
                  </div>
                )}

               <div>
                 <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1">Image URL *</label>
                 <input
                   type="url"
                   required
                   value={newSaree.image_url}
                   onChange={(e) => setNewSaree({ ...newSaree, image_url: e.target.value })}
                   placeholder="e.g. https://example.com/saree.jpg"
                   className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm"
                 />
               </div>

               <div>
                 <label className="block text-[10px] font-bold tracking-wider uppercase text-stone-500 mb-1">Description</label>
                 <textarea
                   rows={3}
                   value={newSaree.description}
                   onChange={(e) => setNewSaree({ ...newSaree, description: e.target.value })}
                   placeholder="Enter details about fabric count, patterns, etc."
                   className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 focus:outline-none focus:border-[#004225] focus:ring-1 focus:ring-[#004225]/10 rounded-sm resize-none"
                 />
               </div>

               <button
                 type="submit"
                 disabled={isAddingSaree}
                 className="w-full bg-[#004225] hover:bg-[#005c34] text-white tracking-widest uppercase text-xs font-bold py-3.5 flex items-center justify-center space-x-2 transition-colors rounded-sm shadow-md"
               >
                 {isAddingSaree ? (
                   <>
                     <Loader2 className="w-3.5 h-3.5 animate-spin" />
                     <span>Adding...</span>
                   </>
                 ) : (
                   <>
                     <Plus className="w-3.5 h-3.5" />
                     <span>Add Product</span>
                   </>
                 )}
               </button>
              </form>
            </div>
          </div>
          </>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="mb-8">
               <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase mb-2">Business Insights & Analytics</h2>
               <p className="text-stone-500 text-lg">Executive metrics overview and collection performance statistics.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Total Revenue Card */}
              <div className="bg-white border border-stone-200 rounded-sm p-10 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xl font-semibold tracking-wider uppercase text-slate-500 block mb-2">Total Revenue (Shipped)</span>
                  <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">₹{totalRevenue}</h3>
                </div>
                <p className="text-sm text-stone-500 mt-4">Calculated from all completed orders marked as Shipped.</p>
              </div>

              {/* Order Volume Card */}
              <div className="bg-white border border-stone-200 rounded-sm p-10 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xl font-semibold tracking-wider uppercase text-slate-500 block mb-2">Order Volume</span>
                  <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">{totalOrdersCount} <span className="text-xl text-slate-500 font-sans font-normal">total orders</span></h3>
                  
                  {/* Split Visual Indicator */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-lg font-semibold uppercase tracking-wider text-slate-500">
                      <span>Pending: {pendingOrdersCount}</span>
                      <span>Shipped: {shippedOrdersCount}</span>
                    </div>
                    <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-yellow-500" 
                        style={{ width: `${totalOrdersCount > 0 ? (pendingOrdersCount / totalOrdersCount) * 100 : 0}%` }} 
                      />
                      <div 
                        className="h-full bg-green-600" 
                        style={{ width: `${totalOrdersCount > 0 ? (shippedOrdersCount / totalOrdersCount) * 100 : 0}%` }} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Category Performance Card */}
              <div className="bg-white border border-stone-200 rounded-sm p-10 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xl font-semibold tracking-wider uppercase text-slate-500 block mb-2">Top Category Performance</span>
                  <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 uppercase whitespace-normal break-words">{topCollection}</h3>
                  <p className="text-lg text-stone-500 mt-1">{maxCount > 0 ? `${maxCount} order(s) placed` : 'No category data yet'}</p>
                </div>
                <p className="text-sm text-stone-500 mt-4">Dynamically computed from matches in recent order logs.</p>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <div className="bg-stone-900 text-stone-300 py-12 mt-auto">
         <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-[#D4AF37] font-serif text-xl tracking-widest mb-3">Artisanal Craftsmanship</h2>
            <p className="text-stone-400 max-w-2xl mx-auto leading-relaxed font-light text-sm">
               SHAHI'S BOUTIQUE celebrates traditional weave patterns, hand block print techniques, and premium modern silhouettes.
            </p>
         </div>
      </div>
    </div>
  );
}

// --- App Router ---
function App() {
  return (
    <Routes>
      <Route path="/" element={<Storefront />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/shipping" element={<ShippingDashboard />} />
    </Routes>
  );
}

export default App;
