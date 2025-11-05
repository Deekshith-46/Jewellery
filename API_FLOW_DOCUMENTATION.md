# 💍 Complete API Flow Documentation - RTS & DYO

## 📋 Table of Contents

1. [Overview](#overview)
2. [Ready-To-Ship (RTS) Flow](#ready-to-ship-rts-flow)
3. [Design-Your-Own (DYO) Flow](#design-your-own-dyo-flow)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
6. [Payment Integration](#payment-integration)
7. [Frontend Implementation Guide](#frontend-implementation-guide)

---

## Overview

This system supports **two distinct product flows**:

| Feature | Ready-To-Ship (RTS) | Design-Your-Own (DYO) |
|---------|---------------------|----------------------|
| **Price Calculation** | ✅ Fixed (stored in DB) | ✅ Dynamic (metal + diamond + setting) |
| **Product Type** | `itemType: 'rts'` | `itemType: 'dyo'` |
| **Stock Management** | ✅ Yes (decrements on order) | ❌ No (made to order) |
| **Price Breakdown** | ❌ Not needed | ✅ Stored (metal_cost, diamond_price, setting_price) |

---

## Ready-To-Ship (RTS) Flow

### 📋 Complete RTS Order Flow

```
1. Browse Products
   ↓
   GET /api/products?readyToShip=true
   
2. View Variants
   ↓
   GET /api/variants?productSku=RING-001&readyToShip=true
   
3. Add to Cart (can add multiple items)
   ↓
   POST /api/cart/rts
   Body: { variantId: "67890abcdef12345", quantity: 1 }
   // OR: { variant_sku: "RING-001-14W-1.5-RND", quantity: 1 }
   
   (Optional: Add more items to cart)
   ↓
   POST /api/cart/rts
   Body: { variantId: "67890abcdef12346", quantity: 1 }
   // OR: { variant_sku: "RING-002-18Y-2.0-OVL", quantity: 1 }
   
4. View Cart (see all items)
   ↓
   GET /api/cart
   Response: { items: [...], subtotal: 131600 }
   
5. Checkout (creates order from ALL cart items)
   ↓
   POST /api/orders/checkout
   Body: { contactEmail, shippingAddress, paymentMethod }
   
   Backend automatically:
   - Reads ALL items from your cart
   - Validates stock
   - Calculates tax & shipping
   - Creates order
   - Clears cart
   
6. Order Created
   ↓
   Response: { orderId: "ORD-xxx", total: 143444, ... }
   
7. Process Payment
   ↓
   Razorpay/Stripe with order.total
```

---

### 🛍️ Step 1: Browse RTS Products

**Endpoint**: `GET /api/products?readyToShip=true`

**Response**:
```json
{
  "success": true,
  "products": [
    {
      "productSku": "RING-001",
      "productName": "Classic Solitaire Ring",
      "readyToShip": true,
      "variants": [...]
    }
  ]
}
```

### 🛍️ Step 2: View Available Variants

**Endpoint**: `GET /api/variants?productSku=RING-001&readyToShip=true`

**Response**:
```json
{
  "success": true,
  "variants": [
    {
      "_id": "67890abcdef",
      "variant_sku": "RING-001-14W-1.5-RND",
      "productSku": "RING-001",
      "metal_type": "14k_white_gold",
      "shape": "Round",
      "carat": 1.5,
      "price": 45000,
      "stock": 3,
      "readyToShip": true,
      "active": true
    }
  ]
}
```

### 🛒 Step 3: Add RTS Item to Cart

**Endpoint**: `POST /api/cart/rts`

**Note**: This adds the item to your cart. You can add multiple items before checkout.

**Request Body** (Using ID - Recommended):
```json
{
  "variantId": "67890abcdef12345",
  "quantity": 1,
  "engraving": "Forever & Always",
  "specialInstructions": "Gift wrap please"
}
```

**Alternative** (Using SKU):
```json
{
  "variant_sku": "RING-001-14W-1.5-RND",
  "quantity": 1,
  "engraving": "Forever & Always",
  "specialInstructions": "Gift wrap please"
}
```

**Parameters**:
- `variantId` (string) - **Recommended**: MongoDB ObjectId of the variant
- `variant_sku` (string) - Alternative: SKU string
- `quantity` (number) - Quantity to add (default: 1)
- `engraving` (string, optional) - Custom engraving text
- `specialInstructions` (string, optional) - Special notes

**Response**:
```json
{
  "success": true,
  "message": "Item added to cart",
  "cart": {
    "userId": "user123",
    "items": [
      {
        "itemType": "rts",
        "variant_sku": "RING-001-14W-1.5-RND",
        "quantity": 1,
        "pricePerItem": 45000,
        "totalPrice": 45000,
        "engraving": "Forever & Always"
      }
    ],
    "subtotal": 45000,
    "totalItems": 1
  }
}
```

### ✅ Step 4: Checkout

**Endpoint**: `POST /api/orders/checkout`

**How it works**: 
- The checkout endpoint creates an order from **ALL items currently in your cart**
- You don't specify which products in the checkout request
- The backend reads your cart, validates items, and creates the order

**Note**: Tax and shipping costs are **automatically calculated** by the backend:
- **Tax**: 9% of subtotal (configurable via `TAX_RATE` env var)
- **Shipping**: Free for orders ≥ ₹50,000, otherwise ₹500 (configurable via env vars)

**Request Body**:
```json
{
  "contactEmail": "customer@example.com",
  "contactPhone": "+1234567890",
  "shippingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA",
    "phone": "+1234567890"
  },
  "paymentMethod": "Credit Card",
  "discount": 0,
  "customerNotes": "Please deliver before 5 PM"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Order placed successfully",
  "order": {
    "orderId": "ORD-1698765432000-A1B2C3",
    "userId": "user123",
    "items": [
      {
        "itemType": "rts",
        "variant_sku": "RING-001-14W-1.5-RND",
        "quantity": 1,
        "pricePerItem": 45000,
        "totalPrice": 45000,
        "itemSnapshot": {
          "title": "RING-001",
          "description": "14k_white_gold - Round - 1.5ct",
          "specifications": {
            "metal_type": "14k_white_gold",
            "shape": "Round",
            "carat": 1.5
          }
        }
      }
    ],
    "subtotal": 45000,
    "shippingCost": 500,
    "taxes": 4050,
    "discount": 0,
    "total": 49550,
    "status": "Pending",
    "paymentStatus": "Pending",
    "isPaid": false,
    "contactEmail": "customer@example.com"
  }
}
```

**Price Calculation**:
- Subtotal: ₹45,000 (from cart)
- Tax (9%): ₹4,050 (auto-calculated: 45000 × 0.09)
- Shipping: ₹500 (auto-calculated: subtotal < ₹50,000)
- **Total**: ₹49,550

---

## Design-Your-Own (DYO) Flow

### 📋 Complete DYO Order Flow

```
1. Browse DYO Products
   ↓
   GET /api/products?readyToShip=false
   
2. Get Metal Options
   ↓
   GET /api/metals
   
3. Get Diamond Options
   ↓
   GET /api/diamonds?shape=Round&carat=1.5
   
4. Calculate Price (Frontend)
   ↓
   metal_cost = rate_per_gram × metal_weight
   diamond_price = from diamonds API
   setting_price = product.default_price
   total = metal_cost + diamond_price + setting_price
   
5. Add to Cart (can add multiple items)
   ↓
   POST /api/cart/dyo
   Body: {
     productId: "507f1f77bcf86cd799439011",
     selectedMetal: "18k_yellow_gold",
     selectedShape: "Round",
     diamondId: "507f1f77bcf86cd799439012"
   }
   // OR use SKUs: { productSku: "RING-002", diamondSku: "DIA-RND-..." }
   
   Backend calculates and stores priceBreakdown
   
6. View Cart (see all items with breakdown)
   ↓
   GET /api/cart
   Response: { 
     items: [{ 
       priceBreakdown: { metal_cost, diamond_price, setting_price }
     }],
     subtotal: 86600
   }
   
7. Checkout (creates order from ALL cart items)
   ↓
   POST /api/orders/checkout
   Body: { contactEmail, shippingAddress, paymentMethod }
   
   Backend automatically:
   - Reads ALL items from cart
   - Calculates tax & shipping
   - Creates order with price breakdown
   - Clears cart
   
8. Order Created with Price Breakdown
   ↓
   Response: { 
     orderId: "ORD-xxx",
     items: [{ priceBreakdown: {...} }],
     total: 94394
   }
```

---

### 🎨 Step 1: Browse DYO Products

**Endpoint**: `GET /api/products?readyToShip=false`

**Response**:
```json
{
  "success": true,
  "products": [
    {
      "productSku": "RING-002",
      "productName": "Customizable Engagement Ring",
      "readyToShip": false,
      "default_price": 12000,
      "metadata": {
        "metal_weight": 5.5
      }
    }
  ]
}
```

### 💎 Step 2: Get Available Metals

**Endpoint**: `GET /api/metals`

**Response**:
```json
{
  "success": true,
  "metals": [
    {
      "metal_type": "14k_white_gold",
      "rate_per_gram": 5600,
      "price_multiplier": 1.15
    },
    {
      "metal_type": "18k_yellow_gold",
      "rate_per_gram": 7200,
      "price_multiplier": 1.25
    },
    {
      "metal_type": "platinum",
      "rate_per_gram": 11000,
      "price_multiplier": 1.5
    }
  ]
}
```

### 💎 Step 3: Get Available Diamonds

**Endpoint**: `GET /api/diamonds?shape=Round&carat=1.5`

**Response**:
```json
{
  "success": true,
  "diamonds": [
    {
      "_id": "diamond123",
      "sku": "DIA-RND-150-VVS1-D",
      "shape": "Round",
      "carat": 1.5,
      "cut": "Excellent",
      "color": "D",
      "clarity": "VVS1",
      "price": 35000,
      "available": true,
      "active": true
    }
  ]
}
```

### 🧮 Step 4: Frontend Price Calculation

**Frontend JavaScript Example**:
```javascript
// Product data
const product = {
  productSku: "RING-002",
  default_price: 12000, // setting price
  metadata: { metal_weight: 5.5 }
};

// Selected options
const selectedMetal = {
  metal_type: "18k_yellow_gold",
  rate_per_gram: 7200
};

const selectedDiamond = {
  sku: "DIA-RND-150-VVS1-D",
  price: 35000
};

// Calculate price breakdown
const metal_weight = product.metadata.metal_weight || 5;
const metal_cost = selectedMetal.rate_per_gram * metal_weight;
const diamond_price = selectedDiamond.price;
const setting_price = product.default_price;

const totalPrice = metal_cost + diamond_price + setting_price;

console.log({
  metal_cost: 39600,      // 7200 * 5.5
  diamond_price: 35000,
  setting_price: 12000,
  totalPrice: 86600       // Sum of all
});

// Display to user:
// "Metal (18K Yellow Gold): ₹39,600"
// "Diamond (1.5ct Round VVS1 D): ₹35,000"
// "Setting & Labor: ₹12,000"
// "Total: ₹86,600"
```

### 🛒 Step 5: Add DYO Item to Cart

**Endpoint**: `POST /api/cart/dyo`

**Note**: This adds the customized item to your cart. You can add multiple items (RTS + DYO) before checkout.

**Request Body** (Using IDs - Recommended):
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "selectedMetal": "18k_yellow_gold",
  "selectedShape": "Round",
  "selectedCarat": 1.5,
  "diamondId": "507f1f77bcf86cd799439012",
  "quantity": 1,
  "engraving": "Our Forever",
  "specialInstructions": "Premium packaging"
}
```

**Alternative** (Using SKUs):
```json
{
  "productSku": "RING-002",
  "selectedMetal": "18k_yellow_gold",
  "selectedShape": "Round",
  "selectedCarat": 1.5,
  "diamondSku": "DIA-RND-150-VVS1-D",
  "quantity": 1,
  "engraving": "Our Forever",
  "specialInstructions": "Premium packaging"
}
```

**Parameters**:
- `productId` (string) - **Recommended**: MongoDB ObjectId of the product
- `productSku` (string) - Alternative: Product SKU
- `selectedMetal` (string) - Metal type (e.g., "18k_yellow_gold")
- `selectedShape` (string) - Diamond shape (e.g., "Round")
- `selectedCarat` (number) - Diamond carat weight
- `diamondId` (string) - **Recommended**: MongoDB ObjectId of the diamond
- `diamondSku` (string) - Alternative: Diamond SKU
- `quantity` (number) - Quantity (default: 1)
- `engraving` (string, optional) - Custom engraving
- `specialInstructions` (string, optional) - Special notes

**Response**:
```json
{
  "success": true,
  "message": "Custom item added to cart",
  "cart": {
    "userId": "user123",
    "items": [
      {
        "itemType": "dyo",
        "productSku": "RING-002",
        "selectedMetal": "18k_yellow_gold",
        "selectedShape": "Round",
        "selectedCarat": 1.5,
        "diamondSku": "DIA-RND-150-VVS1-D",
        "quantity": 1,
        "pricePerItem": 86600,
        "totalPrice": 86600,
        "priceBreakdown": {
          "metal_cost": 39600,
          "diamond_price": 35000,
          "setting_price": 12000,
          "metal_weight": 5.5
        }
      }
    ],
    "subtotal": 86600,
    "totalItems": 1
  }
}
```

### ✅ Step 6: Checkout

**Endpoint**: `POST /api/orders/checkout`

**Note**: Tax and shipping are **automatically calculated** - you don't need to send them!

**Request Body**:
```json
{
  "contactEmail": "customer@example.com",
  "contactPhone": "+1234567890",
  "shippingAddress": {
    "firstName": "Jane",
    "lastName": "Smith",
    "address": "456 Oak Ave",
    "city": "Los Angeles",
    "state": "CA",
    "postalCode": "90001",
    "country": "USA",
    "phone": "+1234567890"
  },
  "paymentMethod": "Credit Card",
  "discount": 0,
  "customerNotes": "Rush delivery please"
}
```

The checkout process is identical to RTS. The order will automatically include the `priceBreakdown` for DYO items.

**Order Response** (DYO item):
```json
{
  "orderId": "ORD-1698765432001-X9Y8Z7",
  "items": [
    {
      "itemType": "dyo",
      "productSku": "RING-002",
      "selectedMetal": "18k_yellow_gold",
      "selectedShape": "Round",
      "selectedCarat": 1.5,
      "diamondSku": "DIA-RND-150-VVS1-D",
      "pricePerItem": 86600,
      "totalPrice": 86600,
      "priceBreakdown": {
        "metal_cost": 39600,
        "diamond_price": 35000,
        "setting_price": 12000,
        "metal_weight": 5.5
      },
      "itemSnapshot": {
        "title": "Customizable Engagement Ring",
        "specifications": {
          "metal": "18k_yellow_gold",
          "shape": "Round",
          "carat": 1.5,
          "diamond": {
            "sku": "DIA-RND-150-VVS1-D",
            "shape": "Round",
            "carat": 1.5,
            "cut": "Excellent",
            "color": "D",
            "clarity": "VVS1"
          },
          "priceBreakdown": {
            "metal_cost": 39600,
            "diamond_price": 35000,
            "setting_price": 12000,
            "metal_weight": 5.5
          }
        }
      }
    }
  ],
  "subtotal": 86600,
  "shippingCost": 0,
  "taxes": 7794,
  "discount": 0,
  "total": 94394,
  "status": "Pending",
  "paymentStatus": "Pending",
  "isPaid": false
}
```

**Price Calculation**:
- Subtotal: ₹86,600 (from cart)
- Tax (9%): ₹7,794 (auto-calculated: 86600 × 0.09)
- Shipping: ₹0 (auto-calculated: Free shipping for orders ≥ ₹50,000)
- **Total**: ₹94,394

---

## Data Models

### Cart Item Schema

```javascript
{
  itemType: 'rts' | 'dyo',           // Product type
  
  // RTS fields
  variant: ObjectId,                  // Reference to Variant
  variant_sku: String,
  
  // DYO fields
  product: ObjectId,                  // Reference to Product
  productSku: String,
  selectedMetal: String,              // e.g., "18k_yellow_gold"
  selectedShape: String,              // e.g., "Round"
  selectedCarat: Number,              // e.g., 1.5
  selectedDiamond: ObjectId,          // Reference to DiamondSpec
  diamondSku: String,
  
  // Common fields
  quantity: Number,
  pricePerItem: Number,
  totalPrice: Number,
  
  // DYO Price Breakdown
  priceBreakdown: {
    metal_cost: Number,               // rate_per_gram × metal_weight
    diamond_price: Number,            // From Diamonds table
    setting_price: Number,            // Base setting/labor cost
    metal_weight: Number              // In grams
  },
  
  engraving: String,
  specialInstructions: String
}
```

### Order Schema (Key Fields)

```javascript
{
  orderId: String,                    // Unique: "ORD-1698765432000-A1B2C3"
  userId: ObjectId,
  
  items: [OrderItemSchema],           // Same structure as CartItem
  
  subtotal: Number,
  shippingCost: Number,
  taxes: Number,
  discount: Number,
  total: Number,
  
  status: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled',
  
  paymentMethod: String,
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Refunded',
  isPaid: Boolean,                    // ✅ NEW: Quick boolean check
  transactionId: String,
  paidAt: Date,                       // ✅ NEW: Payment timestamp
  
  shippingAddress: {...},
  trackingNumber: String,
  estimatedDelivery: Date,
  actualDelivery: Date
}
```

---

## API Endpoints

### Cart APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/cart` | Get user's cart | ✅ Required |
| POST | `/api/cart/rts` | Add RTS item to cart | ✅ Required |
| POST | `/api/cart/dyo` | Add DYO item to cart | ✅ Required |
| PUT | `/api/cart/items/:itemId` | Update cart item quantity | ✅ Required |
| DELETE | `/api/cart/items/:itemId` | Remove item from cart | ✅ Required |
| DELETE | `/api/cart` | Clear entire cart | ✅ Required |

### Order APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/orders/checkout` | Create order from cart (tax & shipping auto-calculated) | ✅ Required |
| GET | `/api/orders` | Get all user orders | ✅ Required |
| GET | `/api/orders/:orderId` | Get single order details | ✅ Required |
| PUT | `/api/orders/:orderId/cancel` | Cancel pending order | ✅ Required |
| PUT | `/api/orders/:orderId/payment-status` | Update payment status (webhook) | ❌ No auth |

### Lookup APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/products` | Get all products (filter by `readyToShip`) | ❌ Public |
| GET | `/api/variants?productSku=X&readyToShip=true` | Get variants with filters | ❌ Public |
| GET | `/api/diamonds` | Get available diamonds (filter by `shape`, `carat`) | ❌ Public |
| GET | `/api/metals` | Get all metal rates | ❌ Public |

---

## 🆔 ID vs SKU: Which to Use?

### **Recommended: Use MongoDB ObjectIds**

```javascript
// ✅ Recommended: Use IDs
POST /api/cart/rts
{ "variantId": "67890abcdef12345" }

POST /api/cart/dyo
{ 
  "productId": "507f1f77bcf86cd799439011",
  "diamondId": "507f1f77bcf86cd799439012",
  ...
}
```

### **Alternative: Use SKUs**

```javascript
// ⚠️ Alternative: Use SKUs (slower, less efficient)
POST /api/cart/rts
{ "variant_sku": "RING-001-14W-1.5-RND" }

POST /api/cart/dyo
{ 
  "productSku": "RING-002",
  "diamondSku": "DIA-RND-150-VVS1-D",
  ...
}
```

### Why Use IDs?

| Factor | Using IDs | Using SKUs |
|--------|-----------|------------|
| **Performance** | ✅ Faster (indexed by `_id`) | ⚠️ Slower (indexed by SKU) |
| **Reliability** | ✅ Unique guaranteed | ⚠️ Can change |
| **Database Queries** | ✅ O(1) lookup | ⚠️ O(log n) lookup |
| **Best Practice** | ✅ MongoDB standard | ⚠️ Legacy support |
| **Frontend** | ✅ Direct from API response | ⚠️ Requires parsing SKU |

### When to Use SKUs

- Legacy integrations
- Human-readable URLs
- External system compatibility
- Admin manual operations

### Getting IDs from API Responses

When you fetch products/variants/diamonds, the response includes the `_id`:

```javascript
// Get variants
GET /api/variants?productSku=RING-001&readyToShip=true

// Response includes _id:
{
  "variants": [
    {
      "_id": "67890abcdef12345",  // ← Use this for cart
      "variant_sku": "RING-001-14W-1.5-RND",
      "metal_type": "14k_white_gold",
      ...
    }
  ]
}

// Then add to cart using _id:
POST /api/cart/rts
{ "variantId": "67890abcdef12345" }
```

---

## 🛒 Understanding the Cart-Based Checkout Model

### How It Works

Your e-commerce system uses a **cart-based checkout model**:

1. **Add Items to Cart** → Items stored in your cart (can be multiple)
2. **Checkout** → Creates order from ALL cart items
3. **Cart Cleared** → After successful order creation

### Key Points

✅ **Products are specified when adding to cart**, not during checkout:
```javascript
// RTS: Specify variantId (or variant_sku)
POST /api/cart/rts
{ "variantId": "67890abcdef12345" }  // Recommended: Use ID
// OR
{ "variant_sku": "RING-001-14W-1.5-RND" }  // Alternative: Use SKU

// DYO: Specify productId + diamondId (or SKUs)
POST /api/cart/dyo
{ 
  "productId": "507f1f77bcf86cd799439011",  // Recommended: Use IDs
  "diamondId": "507f1f77bcf86cd799439012",
  "selectedMetal": "18k_yellow_gold", 
  ...
}
// OR
{
  "productSku": "RING-002",  // Alternative: Use SKUs
  "diamondSku": "DIA-RND-150-VVS1-D",
  ...
}
```

✅ **Checkout only needs shipping & payment info**:
```javascript
POST /api/orders/checkout
{
  "contactEmail": "user@example.com",
  "shippingAddress": {...},
  "paymentMethod": "Credit Card"
}
// NO product specifications needed here!
```

✅ **One cart per user**:
- Each user has ONE cart
- Cart persists across sessions
- Can contain multiple items (RTS + DYO mixed)

✅ **Checkout creates order from entire cart**:
- All items in cart → All items in order
- Can't checkout specific items only
- To remove items before checkout, use `DELETE /api/cart/items/:itemId`

### Example: Multiple Items Flow

```javascript
// 1. Add first item (using ID - recommended)
POST /api/cart/rts
{ "variantId": "67890abcdef12345", "quantity": 1 }

// 2. Add second item (using ID - recommended)
POST /api/cart/dyo
{ 
  "productId": "507f1f77bcf86cd799439011",
  "diamondId": "507f1f77bcf86cd799439012",
  "selectedMetal": "18k_yellow_gold", 
  ...
}

// 3. View cart (2 items)
GET /api/cart
// Response: { items: [item1, item2], subtotal: 131600 }

// 4. Checkout ALL items
POST /api/orders/checkout
{ "contactEmail": "...", "shippingAddress": {...}, ... }

// Result: Order with BOTH items
// Response: { orderId: "ORD-xxx", items: [item1, item2], total: 143444 }
```

### If You Want to Order Only Specific Items

**Option 1**: Remove unwanted items before checkout
```javascript
// Remove item from cart
DELETE /api/cart/items/item_id_here

// Then checkout
POST /api/orders/checkout
```

**Option 2**: Clear cart and add only desired item
```javascript
// Clear cart
DELETE /api/cart

// Add only the item you want (using ID)
POST /api/cart/rts
{ "variantId": "67890abcdef12345" }

// Checkout
POST /api/orders/checkout
```

---

## 📦 How to Make an Order - Complete Guide

### Step-by-Step Order Creation Process

#### 1️⃣ **Add Items to Cart**

You can add either RTS or DYO items (or mix both):

**For RTS Items** (Using ID - Recommended):
```javascript
POST /api/cart/rts
Authorization: Bearer <your_token>

{
  "variantId": "67890abcdef12345",
  "quantity": 1
}
```

**For RTS Items** (Using SKU - Alternative):
```javascript
POST /api/cart/rts
Authorization: Bearer <your_token>

{
  "variant_sku": "RING-001-14W-1.5-RND",
  "quantity": 1
}
```

**For DYO Items** (Using IDs - Recommended):
```javascript
POST /api/cart/dyo
Authorization: Bearer <your_token>

{
  "productId": "507f1f77bcf86cd799439011",
  "selectedMetal": "18k_yellow_gold",
  "selectedShape": "Round",
  "selectedCarat": 1.5,
  "diamondId": "507f1f77bcf86cd799439012",
  "quantity": 1
}
```

**For DYO Items** (Using SKUs - Alternative):
```javascript
POST /api/cart/dyo
Authorization: Bearer <your_token>

{
  "productSku": "RING-002",
  "selectedMetal": "18k_yellow_gold",
  "selectedShape": "Round",
  "selectedCarat": 1.5,
  "diamondSku": "DIA-RND-150-VVS1-D",
  "quantity": 1
}
```

#### 2️⃣ **View Cart**

```javascript
GET /api/cart
Authorization: Bearer <your_token>
```

**Response**:
```json
{
  "success": true,
  "cart": {
    "items": [...],
    "subtotal": 86600,
    "totalItems": 1
  }
}
```

#### 3️⃣ **Create Order (Checkout)**

**How Checkout Works**:
1. Backend reads **ALL items from your cart** (added via `/api/cart/rts` or `/api/cart/dyo`)
2. Validates stock availability for RTS items
3. Calculates subtotal from cart items
4. Auto-calculates tax (9%) and shipping (free ≥ ₹50K, else ₹500)
5. Creates order with complete snapshot
6. Clears your cart automatically
7. Returns order with auto-generated `orderId`

**Important**: 
- You **DON'T** specify which products in the checkout request
- The order includes **ALL** items in your cart
- Tax and shipping are **automatically calculated**
- Your cart is **automatically cleared** after successful checkout

```javascript
POST /api/orders/checkout
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "contactEmail": "customer@example.com",
  "contactPhone": "+1234567890",
  "shippingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "address": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalCode": "400001",
    "country": "India",
    "phone": "+919876543210"
  },
  "billingAddress": {
    // Optional - if not provided, uses shippingAddress
    "firstName": "John",
    "lastName": "Doe",
    "address": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalCode": "400001",
    "country": "India"
  },
  "paymentMethod": "Credit Card",
  "discount": 0,
  "customerNotes": "Please call before delivery"
}
```

**What You DON'T Send**:
- ❌ `shippingCost` - Automatically calculated
- ❌ `taxes` - Automatically calculated (9% of subtotal)

**Auto-Calculation Rules**:

| Condition | Tax | Shipping | Total |
|-----------|-----|----------|-------|
| Subtotal < ₹50,000 | 9% | ₹500 | Subtotal + Tax + ₹500 |
| Subtotal ≥ ₹50,000 | 9% | **Free** | Subtotal + Tax |

**Example Calculations**:

**Example 1: Small Order (₹30,000)**
```
Subtotal:    ₹30,000
Tax (9%):    ₹2,700 (auto-calculated)
Shipping:    ₹500 (auto-calculated)
Total:       ₹33,200
```

**Example 2: Large Order (₹86,600)**
```
Subtotal:    ₹86,600
Tax (9%):    ₹7,794 (auto-calculated)
Shipping:    ₹0 (FREE - order ≥ ₹50,000)
Total:       ₹94,394
```

#### 4️⃣ **Receive Order Response**

```json
{
  "success": true,
  "message": "Order placed successfully",
  "order": {
    "orderId": "ORD-1698765432000-A1B2C3",
    "userId": "user123",
    "items": [
      {
        "itemType": "dyo",
        "productSku": "RING-002",
        "pricePerItem": 86600,
        "totalPrice": 86600,
        "priceBreakdown": {
          "metal_cost": 39600,
          "diamond_price": 35000,
          "setting_price": 12000,
          "metal_weight": 5.5
        }
      }
    ],
    "subtotal": 86600,
    "taxes": 7794,
    "shippingCost": 0,
    "discount": 0,
    "total": 94394,
    "status": "Pending",
    "paymentStatus": "Pending",
    "isPaid": false,
    "contactEmail": "customer@example.com",
    "shippingAddress": {...},
    "createdAt": "2025-10-30T10:00:00.000Z"
  }
}
```

#### 5️⃣ **Process Payment**

After order creation, initiate payment with your payment gateway:

```javascript
// Example with Razorpay
const options = {
  key: 'YOUR_RAZORPAY_KEY',
  amount: order.total * 100, // Amount in paise
  currency: 'INR',
  name: 'Your Jewellery Store',
  description: `Order #${order.orderId}`,
  order_id: razorpayOrderId, // Create this via Razorpay API
  handler: function(response) {
    // Payment successful
    console.log('Payment ID:', response.razorpay_payment_id);
    
    // Webhook will automatically update order status
    // Or you can manually verify and update
  },
  prefill: {
    email: order.contactEmail,
    contact: order.contactPhone
  },
  notes: {
    orderId: order.orderId
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

#### 6️⃣ **Payment Webhook Updates Order**

When payment succeeds, your webhook calls:

```javascript
PUT /api/orders/ORD-1698765432000-A1B2C3/payment-status

{
  "paymentStatus": "Paid",
  "transactionId": "pay_ABC123XYZ",
  "isPaid": true
}
```

This automatically:
- ✅ Sets `isPaid = true`
- ✅ Sets `paidAt = current timestamp`
- ✅ Updates `status` from "Pending" to "Confirmed"

#### 7️⃣ **View Order Details**

```javascript
GET /api/orders/ORD-1698765432000-A1B2C3
Authorization: Bearer <your_token>
```

**Response**:
```json
{
  "success": true,
  "order": {
    "orderId": "ORD-1698765432000-A1B2C3",
    "status": "Confirmed",
    "paymentStatus": "Paid",
    "isPaid": true,
    "paidAt": "2025-10-30T10:15:00.000Z",
    "transactionId": "pay_ABC123XYZ",
    "total": 94394,
    ...
  }
}
```

---

### 🎨 Frontend Cart Summary Example

Display estimated costs to users before checkout:

```javascript
// In your cart page
const CartSummary = ({ cart }) => {
  const subtotal = cart.subtotal;
  const tax = Math.round(subtotal * 0.09); // 9% tax
  const shipping = subtotal >= 50000 ? 0 : 500;
  const total = subtotal + tax + shipping;
  
  return (
    <div className="cart-summary">
      <div className="line-item">
        <span>Subtotal</span>
        <span>₹{subtotal.toLocaleString()}</span>
      </div>
      
      <div className="line-item">
        <span>Tax (9%)</span>
        <span>₹{tax.toLocaleString()}</span>
      </div>
      
      <div className="line-item">
        <span>Shipping</span>
        {shipping === 0 ? (
          <span className="free-shipping">FREE ✓</span>
        ) : (
          <span>₹{shipping}</span>
        )}
      </div>
      
      {subtotal < 50000 && (
        <div className="info-message">
          💡 Add ₹{(50000 - subtotal).toLocaleString()} more for FREE shipping!
        </div>
      )}
      
      <div className="total">
        <strong>Total</strong>
        <strong>₹{total.toLocaleString()}</strong>
      </div>
    </div>
  );
};
```

---

### ⚙️ Configuration Options

You can customize tax and shipping rules via environment variables:

```env
# Tax rate (0.09 = 9%)
TAX_RATE=0.09

# Free shipping threshold (in rupees)
FREE_SHIPPING_THRESHOLD=50000

# Standard shipping cost (in rupees)
STANDARD_SHIPPING_COST=500
```

**Different Tax Rates by Region** (Future Enhancement):
```javascript
// In orderController.js, you can modify to use region-based tax
const getTaxRate = (state) => {
  const taxRates = {
    'Maharashtra': 0.09,
    'Karnataka': 0.09,
    'Delhi': 0.09,
    // Add more states
  };
  return taxRates[state] || 0.09; // Default 9%
};

const tax = Math.round(subtotal * getTaxRate(shippingAddress.state));
```

---

### 🔍 Common Scenarios

#### Scenario 1: Mixed Cart (RTS + DYO)

```javascript
// Cart contains:
// - 1 RTS ring (₹45,000)
// - 1 DYO ring (₹86,600)

{
  "items": [
    { "itemType": "rts", "totalPrice": 45000 },
    { "itemType": "dyo", "totalPrice": 86600 }
  ],
  "subtotal": 131600
}

// Auto-calculation:
// Tax: ₹11,844 (131600 × 0.09)
// Shipping: ₹0 (FREE - subtotal > ₹50K)
// Total: ₹143,444
```

#### Scenario 2: Discount Code Applied

```javascript
POST /api/orders/checkout

{
  "contactEmail": "customer@example.com",
  "shippingAddress": {...},
  "paymentMethod": "Credit Card",
  "discount": 5000  // ₹5,000 discount
}

// Calculation:
// Subtotal: ₹86,600
// Tax: ₹7,794
// Shipping: ₹0
// Discount: -₹5,000
// Total: ₹89,394
```

#### Scenario 3: Just Below Free Shipping

```javascript
// Subtotal: ₹49,500
// Tax: ₹4,455 (49500 × 0.09)
// Shipping: ₹500 (not eligible for free shipping)
// Total: ₹54,455

// Customer adds ₹500 more to cart
// New Subtotal: ₹50,000
// Tax: ₹4,500
// Shipping: ₹0 (FREE!)
// New Total: ₹54,500
// Savings: ₹455 (by avoiding shipping cost)
```

---

### ✅ Order Status Flow

```
1. Order Created
   ├─ status: "Pending"
   ├─ paymentStatus: "Pending"
   └─ isPaid: false

2. Payment Received (via webhook)
   ├─ status: "Confirmed" (auto-updated)
   ├─ paymentStatus: "Paid"
   ├─ isPaid: true
   └─ paidAt: timestamp

3. Admin Processes Order
   ├─ status: "Processing"

4. Order Shipped
   ├─ status: "Shipped"
   ├─ trackingNumber: "1Z999AA1234567890"
   └─ estimatedDelivery: date

5. Order Delivered
   ├─ status: "Delivered"
   └─ actualDelivery: date
```

---

## Payment Integration

### Payment Webhook Handler

When your payment gateway (Razorpay, Stripe, etc.) confirms payment, call:

**Endpoint**: `PUT /api/orders/:orderId/payment-status`

**Request Body** (from payment gateway webhook):
```json
{
  "paymentStatus": "Paid",
  "transactionId": "txn_1234567890abcdef",
  "isPaid": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payment status updated successfully",
  "order": {
    "orderId": "ORD-1698765432000-A1B2C3",
    "paymentStatus": "Paid",
    "isPaid": true,
    "paidAt": "2025-10-30T10:30:00.000Z",
    "transactionId": "txn_1234567890abcdef",
    "status": "Confirmed"  // Auto-updated from Pending
  }
}
```

### Payment Gateway Integration Examples

#### Razorpay Webhook
```javascript
app.post('/webhooks/razorpay', async (req, res) => {
  const { orderId, payment_id, status } = req.body;
  
  if (status === 'captured') {
    await fetch(`${API_URL}/api/orders/${orderId}/payment-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'Paid',
        transactionId: payment_id,
        isPaid: true
      })
    });
  }
  
  res.json({ success: true });
});
```

#### Stripe Webhook
```javascript
app.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;
  
  if (event.type === 'payment_intent.succeeded') {
    const { orderId } = event.data.object.metadata;
    
    await fetch(`${API_URL}/api/orders/${orderId}/payment-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'Paid',
        transactionId: event.data.object.id,
        isPaid: true
      })
    });
  }
  
  res.json({ received: true });
});
```

---

## Frontend Implementation Guide

### RTS Product Page

```javascript
// Fetch RTS product with variants
const response = await fetch('/api/variants?productSku=RING-001&readyToShip=true');
const { variants } = await response.json();

// Display variants
variants.forEach(variant => {
  console.log(`
    ${variant.metal_type} - ${variant.shape} - ${variant.carat}ct
    Price: ₹${variant.price}
    Stock: ${variant.stock}
  `);
});

// Add to cart (Using ID - Recommended)
const addToCart = async (variant) => {
  await fetch('/api/cart/rts', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      variantId: variant._id,  // Use _id from API response
      quantity: 1
    })
  });
};

// Add to cart (Using SKU - Alternative)
const addToCartBySku = async (variant_sku) => {
  await fetch('/api/cart/rts', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      variant_sku,
      quantity: 1
    })
  });
};
```

### DYO Product Page

```javascript
// Fetch metals and diamonds
const [metalsRes, diamondsRes, productRes] = await Promise.all([
  fetch('/api/metals'),
  fetch('/api/diamonds?shape=Round'),
  fetch('/api/products/RING-002')
]);

const { metals } = await metalsRes.json();
const { diamonds } = await diamondsRes.json();
const { product } = await productRes.json();

// Calculate price in real-time
const calculatePrice = () => {
  const metal = metals.find(m => m.metal_type === selectedMetal);
  const diamond = diamonds.find(d => d.sku === selectedDiamond);
  
  const metal_weight = product.metadata?.metal_weight || 5;
  const metal_cost = metal.rate_per_gram * metal_weight;
  const diamond_price = diamond.price;
  const setting_price = product.default_price;
  
  return {
    metal_cost,
    diamond_price,
    setting_price,
    total: metal_cost + diamond_price + setting_price
  };
};

// Add to cart (Using IDs - Recommended)
const addToCart = async () => {
  const selectedDiamondObj = diamonds.find(d => d._id === selectedDiamondId);
  
  await fetch('/api/cart/dyo', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      productId: product._id,  // Use _id from product
      selectedMetal: selectedMetal,
      selectedShape: selectedShape,
      selectedCarat: selectedCarat,
      diamondId: selectedDiamondObj._id,  // Use _id from diamond
      quantity: 1
    })
  });
};

// Add to cart (Using SKUs - Alternative)
const addToCartBySku = async () => {
  await fetch('/api/cart/dyo', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      productSku: product.productSku,
      selectedMetal: selectedMetal,
      selectedShape: selectedShape,
      selectedCarat: selectedCarat,
      diamondSku: selectedDiamond,
      quantity: 1
    })
  });
};
```

### Checkout Page

```javascript
// Get cart
const cartRes = await fetch('/api/cart', {
  headers: { 'Authorization': `Bearer ${userToken}` }
});
const { cart } = await cartRes.json();

// Display cart items with breakdown
cart.items.forEach(item => {
  if (item.itemType === 'dyo' && item.priceBreakdown) {
    console.log(`
      Metal Cost: ₹${item.priceBreakdown.metal_cost}
      Diamond Price: ₹${item.priceBreakdown.diamond_price}
      Setting Price: ₹${item.priceBreakdown.setting_price}
      Total: ₹${item.totalPrice}
    `);
  } else {
    console.log(`RTS Item: ₹${item.totalPrice}`);
  }
});

// Checkout
const checkout = async (shippingInfo) => {
  const orderRes = await fetch('/api/orders/checkout', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      contactEmail: shippingInfo.email,
      contactPhone: shippingInfo.phone,
      shippingAddress: shippingInfo.address,
      paymentMethod: 'Credit Card',
      discount: 0,
      customerNotes: shippingInfo.notes || ''
      // Note: NO shippingCost or taxes needed!
      // Backend auto-calculates:
      // - Tax: 9% of subtotal
      // - Shipping: Free if subtotal >= ₹50,000, else ₹500
    })
  });
  
  const { order } = await orderRes.json();
  
  console.log('Order created:', {
    orderId: order.orderId,
    subtotal: order.subtotal,
    taxes: order.taxes,           // Auto-calculated
    shippingCost: order.shippingCost, // Auto-calculated
    total: order.total
  });
  
  // Initiate payment with gateway
  // After payment success, webhook will update order status
};
```

---

## 🎯 Summary Checklist

### ✅ Backend (100% Complete)

- ✅ `itemType` field in Cart and Order (`'rts'` or `'dyo'`)
- ✅ `priceBreakdown` stored in Cart and Order for DYO items
- ✅ `isPaid` boolean field in Order
- ✅ `paidAt` timestamp in Order
- ✅ Dynamic price calculation in DYO cart controller
- ✅ Price breakdown copied from cart to order during checkout
- ✅ Payment status update endpoint for webhooks
- ✅ Auto-confirm order when `isPaid = true`
- ✅ Stock management for RTS items
- ✅ Order snapshot with complete item details
- ✅ **Auto-calculate tax (9% of subtotal)**
- ✅ **Auto-calculate shipping (Free ≥ ₹50K, else ₹500)**
- ✅ Variants API with query parameters

### 📱 Frontend Requirements

- 🔲 Display RTS variants with fixed prices
- 🔲 Real-time DYO price calculator
- 🔲 Show price breakdown for DYO items (metal + diamond + setting)
- 🔲 Consistent price calculation between frontend and backend
- 🔲 Display estimated tax (9%) and shipping in cart summary
- 🔲 Show "Free Shipping" badge for orders ≥ ₹50,000
- 🔲 Payment gateway integration (Razorpay/Stripe)
- 🔲 Webhook handling for payment confirmation
- 🔲 Order tracking UI

---

## 📞 Support

For questions or issues, refer to:
- Product Controller: `src/controllers/user/productController.js`
- Cart Controller: `src/controllers/user/cartController.js`
- Order Controller: `src/controllers/user/orderController.js`
- Models: `src/models/user/`

---

**Version**: 1.0  
**Last Updated**: October 30, 2025  
**Status**: ✅ Production Ready

