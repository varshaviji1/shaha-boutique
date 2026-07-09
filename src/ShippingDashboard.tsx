import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';

interface Order {
  id: string;
  created_at: string;
  customer_name?: string;
  phone_number?: string;
  shipping_address?: string;
  pincode?: string;
  total_amount?: number;
  price?: number;
  status: string;
  status_updated_at?: string;
  saree_name?: string;
}

export default function ShippingDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Orders from Supabase in Real-Time
  useEffect(() => {
    fetchOrders();
    
    // Subscribe to real-time order updates
    const subscription = supabase
      .channel('realtime-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  // 2. Handle Status Dropdown & Timestamp updates
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const updatedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: newStatus,
        status_updated_at: updatedTime
      })
      .eq('id', orderId);

    if (!error) {
      // Local state fallback update
      setOrders(prevOrders => 
        prevOrders.map(o => o.id === orderId ? { ...o, status: newStatus, status_updated_at: updatedTime } : o)
      );
    }
  };

  // 3. Trigger Custom Invoice Browser Print Window
  const triggerPrint = (orderId: string) => {
    const printElement = document.getElementById(`printable-invoice-${orderId}`);
    if (!printElement) return;
    const printContent = printElement.innerHTML;
    const originalContent = document.body.innerHTML;
    
    // Temporarily replace body with targeted invoice container for a clean print
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); // Refresh to restore standard React app state cleanly
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 font-sans text-slate-600">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-slate-800" />
        <div className="text-lg">Loading Order Dashboard...</div>
      </div>
    );
  }

  const shippingFee = 60; // Standard shipping is ₹60 based on App.tsx storefront implementation

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans antialiased text-slate-800 text-lg md:text-xl">
      <header className="mb-8 border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide text-slate-900 uppercase">Shahi's Boutique Fulfillment</h1>
          <p className="text-sm text-slate-500 mt-1">Manage, update, and print shipping invoices dynamically.</p>
        </div>
        <div className="flex gap-3">
          <Link 
            to="/admin" 
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 transition-all bg-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Merchant Dashboard
          </Link>
          <Link 
            to="/" 
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          >
            Storefront
          </Link>
        </div>
      </header>

      <div className="space-y-8">
        {orders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
            No orders found in the database.
          </div>
        ) : (
          orders.map((order) => {
            const orderTotal = order.total_amount || order.price || 0;
            const subtotal = orderTotal > shippingFee ? orderTotal - shippingFee : 0;
            return (
              <div key={order.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                
                {/* Order Header banner */}
                <div className="bg-slate-900 px-6 py-3 flex justify-between items-center text-white">
                  <span className="font-mono text-sm tracking-wider font-semibold">ORDER ID: #{String(order.id).slice(0, 8).toUpperCase()}</span>
                  <span className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>

                {/* Three Blocks Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 p-6">
                  
                  {/* BLOCK 1: SHIPPING DETAILS */}
                  <div className="pb-6 md:pb-0 md:pr-6 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Shipping Details</h3>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-slate-500">Order Stage Status:</label>
                      <select 
                        value={order.status || 'Pending'} 
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className="w-full max-w-xs border border-slate-300 rounded-lg p-3 text-base md:text-lg bg-white font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 outline-none"
                      >
                        <option value="Pending">🕒 Pending</option>
                        <option value="Packed">📦 Packed</option>
                        <option value="Shipped">🚚 Shipped</option>
                      </select>
                    </div>
                    <div className="text-sm md:text-base text-slate-500 font-mono pt-1">
                      Last updated stamp: <span className="text-slate-800 font-bold">{order.status_updated_at || 'Not modified yet'}</span>
                    </div>
                  </div>

                  {/* BLOCK 2: SHIPPING ADDRESS */}
                  <div className="py-6 md:py-0 md:px-6 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Shipping Address</h3>
                    <div className="text-slate-800 space-y-1">
                      <p className="font-bold text-xl text-slate-900">{order.customer_name || 'Customer Name'}</p>
                      <p className="font-mono tracking-tight text-slate-800 text-base md:text-lg leading-relaxed">📱 {order.phone_number || 'No Phone provided'}</p>
                      <p className="text-slate-800 text-base md:text-lg leading-relaxed mt-2 whitespace-pre-line">{order.shipping_address || 'No address provided'}</p>
                      <p className="font-mono text-base font-bold text-slate-900 mt-1">PINCODE: {order.pincode || '------'}</p>
                    </div>
                  </div>

                  {/* BLOCK 3: AMOUNT DETAILS & INVOICE PRINT UNIT */}
                  <div className="pt-6 md:pt-0 md:pl-6 flex flex-col justify-between relative">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Amount Details</h3>
                      
                      {/* Amazon style clean, bold pricing stacks */}
                      <div className="space-y-1.5 font-sans text-base md:text-lg text-slate-800">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-bold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shipping Fee:</span>
                          <span className="text-green-650 font-medium">₹{shippingFee}</span>
                        </div>
                        <hr className="border-slate-200 my-1" />
                        <div className="flex justify-between items-center text-lg md:text-xl pt-1">
                          <span className="font-semibold text-slate-900">Grand Total:</span>
                          <span className="font-extrabold text-xl text-slate-900 tracking-tight">₹{orderTotal.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Print Action Buttons Group (Top/Right Corner anchor) */}
                    <div className="mt-6 flex justify-end gap-2">
                      <button 
                        onClick={() => triggerPrint(order.id)}
                        className="flex items-center gap-1.5 px-4 py-2 border-2 border-slate-900 rounded-lg text-xs font-bold text-slate-900 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Invoice / Bill
                      </button>
                    </div>
                  </div>

                </div>

                {/* Hidden Printable Invoice template container */}
                <div id={`printable-invoice-${order.id}`} className="hidden">
                  <div style={{ padding: '60px', fontFamily: 'sans-serif', color: '#111' }}>
                    <h2 style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 10px 0', fontSize: '28px' }}>Shahi's Boutique</h2>
                    <p style={{ textAlign: 'center', fontSize: '18px', color: '#555', margin: '0 0 45px 0' }}>Official Order Invoice & Packing Label</p>
                    <hr style={{ border: '0', borderTop: '1px solid #ccc' }} />
                    
                    <table style={{ width: '100%', margin: '30px 0', fontSize: '22px', lineHeight: '30px' }}>
                      <tbody>
                        <tr>
                          <td style={{ verticalAlign: 'top', width: '50%' }}>
                            <strong>SHIP TO:</strong><br />
                            {order.customer_name || 'Customer Name'}<br />
                            {order.shipping_address || 'No Address'}<br />
                            <strong>Pincode:</strong> {order.pincode || '------'}<br />
                            <strong>Phone:</strong> {order.phone_number || 'N/A'}
                          </td>
                          <td style={{ verticalAlign: 'top', width: '50%', textAlign: 'right' }}>
                            <strong>Order Ref:</strong> #{String(order.id).slice(0, 8).toUpperCase()}<br />
                            <strong>Date:</strong> {new Date(order.created_at).toLocaleDateString()}<br />
                            <strong>Delivery Status:</strong> {order.status || 'Pending'}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="mt-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 border-b border-gray-300 pb-2 mb-3">
                        Order Items Summary
                      </h3>
                      
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500 font-semibold">
                            <th className="py-2">Item Details</th>
                            <th className="py-2 text-center">Qty</th>
                            <th className="py-2 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            try {
                              // Antigravity: Map this to your actual order data variable holding the JSON string/array
                              const itemsList = typeof order.saree_name === 'string' ? JSON.parse(order.saree_name) : order.saree_name;
                              
                              return itemsList?.map((item: any, idx: number) => (
                                <tr key={idx} className="border-b border-gray-100">
                                  <td className="py-3">
                                    <div className="font-bold text-gray-800">{item.product?.name || 'Boutique Item'}</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5 flex gap-3">
                                      {item.sizeOption && <span><strong>Size:</strong> {item.sizeOption}</span>}
                                      {item.pompomOption && <span><strong>Pompom:</strong> Yes</span>}
                                    </div>
                                  </td>
                                  <td className="py-3 text-center font-medium text-gray-700">{item.quantity || 1}</td>
                                  <td className="py-3 text-right font-semibold text-gray-800">₹{item.product?.price || item.price || '0'}</td>
                                </tr>
                              ));
                            } catch (e) {
                              return (
                                <tr>
                                  <td colSpan={3} className="py-3 text-gray-400 italic">Premium Boutique Selection</td>
                                </tr>
                              );
                            }
                          })()}
                          <tr className="border-t border-gray-200">
                            <td colSpan={2} className="py-2 text-right font-bold text-gray-700">Subtotal:</td>
                            <td className="py-2 text-right font-semibold text-gray-800">₹{subtotal.toLocaleString('en-IN')}</td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="py-2 text-right font-bold text-gray-700">Standard Shipping:</td>
                            <td className="py-2 text-right font-semibold text-gray-800">₹{shippingFee}</td>
                          </tr>
                          <tr className="border-t-2 border-double border-gray-300 text-sm font-bold bg-gray-50">
                            <td colSpan={2} className="py-2.5 text-right text-gray-900">Grand Total Paid:</td>
                            <td className="py-2.5 text-right text-gray-900">₹{orderTotal.toLocaleString('en-IN')}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p style={{ marginTop: '75px', textAlign: 'center', fontSize: '18px', color: '#888' }}>Thank you for purchasing from Shahi's Boutique!</p>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
