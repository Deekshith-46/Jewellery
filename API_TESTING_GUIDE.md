# 🧪 API Testing Guide - Step by Step

Complete step-by-step guide to test Cart and Orders APIs.

---

## 📋 Prerequisites

1. **Server Running**: Your backend should be running on `http://localhost:5000`
2. **Database**: MongoDB connected and seeded with products/variants/diamonds
3. **User Account**: You need a registered user account
4. **Auth Token**: Get JWT token from login/register

---

## 🔐 Step 1: Authentication

### Register a New User

**Request**:
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com",
  "password": "Test@12345",
  "phone": "+1234567890"
}
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "67890abcdef12345",
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

**Save the token** for subsequent requests:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🔍 Step 2: Get Products & Variants

### Get Available Products

**Request**:
```http
GET http://localhost:5000/api/products?readyToShip=true
```

**Response**:
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "productSku": "RING-001",
      "productName": "Classic Solitaire Ring",
      "readyToShip": true
    }
  ]
}
```

### Get Variants for Product (RTS)

**Request**:
```http
GET http://localhost:5000/api/variants?productSku=RING-001&readyToShip=true
```

**Response**:
```json
{
  "success": true,
  "variants": [
    {
      "_id": "67890abcdef12345",
      "variant_sku": "RING-001-14W-1.5-RND",
      "productSku": "RING-001",
      "metal_type": "14k_white_gold",
      "shape": "Round",
      "carat": 1.5,
      "price": 45000,
      "stock": 10,
      "readyToShip": true,
      "active": true
    }
  ]
}
```

**Note**: Save the `_id` - we'll use it to add to cart!

---

## 🛒 Step 3: Add RTS Item to Cart

### Add to Cart (Using ID - Recommended)

**Request**:
```http
POST http://localhost:5000/api/cart/rts
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "variantId": "67890abcdef12345",
  "quantity": 1,
  "engraving": "Forever & Always"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Item added to cart",
  "cart": {
    "userId": "user123",
    "items": [
      {
        "_id": "cart_item_123",
        "itemType": "rts",
        "variant": {
          "_id": "67890abcdef12345",
          "variant_sku": "RING-001-14W-1.5-RND",
          "metal_type": "14k_white_gold",
          "shape": "Round",
          "carat": 1.5,
          "price": 45000,
          "stock": 10
        },
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

**Key Points**:
- ✅ Only stores: `metal_type: "14k_white_gold"`, `shape: "Round"`, `carat: 1.5` (user selected)
- ❌ Does NOT include: All available metals, all available shapes, product metadata

### Verify Cart

**Request**:
```http
GET http://localhost:5000/api/cart
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response**:
```json
{
  "success": true,
  "cart": {
    "items": [
      {
        "itemType": "rts",
        "variant": {
          "variant_sku": "RING-001-14W-1.5-RND",
          "metal_type": "14k_white_gold",  // ✅ Only selected
          "shape": "Round",                  // ✅ Only selected
          "carat": 1.5,                      // ✅ Only selected
          "price": 45000
        },
        "quantity": 1,
        "pricePerItem": 45000,
        "totalPrice": 45000
      }
    ],
    "subtotal": 45000
  }
}
```

---

## 💍 Step 4: Add DYO Item to Cart

### Get DYO Products

**Request**:
```http
GET http://localhost:5000/api/products?readyToShip=false
```

### Get Metals

**Request**:
```http
GET http://localhost:5000/api/metals
```

**Response**:
```json
{
  "success": true,
  "metals": [
    {
      "_id": "metal123",
      "metal_type": "14k_yellow_gold",
      "rate_per_gram": 5600
    },
    {
      "_id": "metal456",
      "metal_type": "18k_yellow_gold",
      "rate_per_gram": 7200
    }
  ]
}
```

### Get Diamonds

**Request**:
```http
GET http://localhost:5000/api/diamonds?shape=Round&carat=1.5
```

**Response**:
```json
{
  "success": true,
  "diamonds": [
    {
      "_id": "diamond789",
      "sku": "DIA-RND-150-VVS1-D",
      "shape": "Round",
      "carat": 1.5,
      "cut": "Excellent",
      "color": "D",
      "clarity": "VVS1",
      "price": 35000
    }
  ]
}
```

### Add DYO Item to Cart

**Request**:
```http
POST http://localhost:5000/api/cart/dyo
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "productId": "507f1f77bcf86cd799439011",
  "selectedMetal": "18k_yellow_gold",
  "selectedShape": "Round",
  "selectedCarat": 1.5,
  "diamondId": "diamond789",
  "quantity": 1
}
```

**Response**:
```json
{
  "success": true,
  "message": "Custom item added to cart",
  "cart": {
    "items": [
      {
        "itemType": "rts",
        // ... previous RTS item
      },
      {
        "itemType": "dyo",
        "product": {
          "_id": "507f1f77bcf86cd799439011",
          "productSku": "RING-002",
          "productName": "Custom Engagement Ring",
          "default_price": 12000
          // ✅ Only minimal product info, NOT all available options
        },
        "selectedMetal": "18k_yellow_gold",  // ✅ User selected
        "selectedShape": "Round",              // ✅ User selected
        "selectedCarat": 1.5,                   // ✅ User selected
        "selectedDiamond": {
          "sku": "DIA-RND-150-VVS1-D",
          "shape": "Round",
          "carat": 1.5,
          "cut": "Excellent",
          "color": "D",
          "clarity": "VVS1",
          "price": 35000
        },
        "priceBreakdown": {
          "metal_cost": 39600,    // Calculated: 7200 × 5.5g
          "diamond_price": 35000,
          "setting_price": 12000,
          "metal_weight": 5.5
        },
        "pricePerItem": 86600,
        "totalPrice": 86600
      }
    ],
    "subtotal": 131600
  }
}
```

**Key Points**:
- ✅ Only stores **user-selected** values:
  - `selectedMetal: "18k_yellow_gold"` (NOT all available metals)
  - `selectedShape: "Round"` (NOT all available shapes)
  - `selectedCarat: 1.5` (NOT all available carats)
- ✅ Product object only has minimal info (SKU, name, price)
- ❌ Does NOT include: `availableMetalTypes`, `availableShapes`, `useAllMetals`, etc.

---

## ✅ Step 5: Checkout (Create Order)

### Checkout Request

**Request**:
```http
POST http://localhost:5000/api/orders/checkout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "contactEmail": "test@example.com",
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
  "paymentMethod": "Credit Card",
  "discount": 0,
  "customerNotes": "Please call before delivery"
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
            "metal_type": "14k_white_gold",  // ✅ Only selected
            "shape": "Round",                 // ✅ Only selected
            "carat": 1.5                      // ✅ Only selected
          }
        }
      },
      {
        "itemType": "dyo",
        "productSku": "RING-002",
        "productName": "Custom Engagement Ring",
        "selectedMetal": "18k_yellow_gold",  // ✅ Only user selected
        "selectedShape": "Round",            // ✅ Only user selected
        "selectedCarat": 1.5,                // ✅ Only user selected
        "diamondSku": "DIA-RND-150-VVS1-D",
        "quantity": 1,
        "pricePerItem": 86600,
        "totalPrice": 86600,
        "priceBreakdown": {
          "metal_cost": 39600,
          "diamond_price": 35000,
          "setting_price": 12000,
          "metal_weight": 5.5
        },
        "itemSnapshot": {
          "title": "Custom Engagement Ring",
          "description": "Customizable engagement ring",
          "specifications": {
            "metal": "18k_yellow_gold",      // ✅ Only selected
            "shape": "Round",                 // ✅ Only selected
            "carat": 1.5,                     // ✅ Only selected
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
              "setting_price": 12000
            }
          }
        }
      }
    ],
    "subtotal": 131600,
    "taxes": 11844,        // Auto-calculated: 9% of 131600
    "shippingCost": 0,     // Auto-calculated: Free (≥ ₹50K)
    "discount": 0,
    "total": 143444,
    "status": "Pending",
    "paymentStatus": "Pending",
    "isPaid": false,
    "contactEmail": "test@example.com",
    "createdAt": "2025-10-30T10:00:00.000Z"
  }
}
```

**Key Points**:
- ✅ Order contains **ONLY user-selected values**:
  - `selectedMetal: "18k_yellow_gold"` (not all available metals)
  - `selectedShape: "Round"` (not all available shapes)
  - `selectedCarat: 1.5` (not all available carats)
- ✅ Product info is minimal (SKU, name only)
- ❌ Does NOT include: `availableMetalTypes`, `availableShapes`, product metadata with all options

---

## 📋 Step 6: View Order

### Get Order Details

**Request**:
```http
GET http://localhost:5000/api/orders/ORD-1698765432000-A1B2C3
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response**:
```json
{
  "success": true,
  "order": {
    "orderId": "ORD-1698765432000-A1B2C3",
    "items": [
      {
        "itemType": "dyo",
        "product": {
          "_id": "507f1f77bcf86cd799439011",
          "productSku": "RING-002",
          "productName": "Custom Engagement Ring"
          // ✅ Only minimal product info, NOT all options
        },
        "selectedMetal": "18k_yellow_gold",  // ✅ Only selected
        "selectedShape": "Round",              // ✅ Only selected
        "selectedCarat": 1.5,                   // ✅ Only selected
        "diamondSku": "DIA-RND-150-VVS1-D",
        "priceBreakdown": {
          "metal_cost": 39600,
          "diamond_price": 35000,
          "setting_price": 12000
        },
        "itemSnapshot": {
          "specifications": {
            "metal": "18k_yellow_gold",  // ✅ Only selected
            "shape": "Round",             // ✅ Only selected
            "carat": 1.5                  // ✅ Only selected
          }
        }
      }
    ],
    "total": 143444,
    "status": "Pending"
  }
}
```

---

## 🔄 Step 7: Verify Cart is Cleared

After checkout, cart should be empty:

**Request**:
```http
GET http://localhost:5000/api/cart
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response**:
```json
{
  "success": true,
  "cart": {
    "items": [],  // ✅ Empty after checkout
    "subtotal": 0,
    "totalItems": 0
  }
}
```

---

## ✅ Verification Checklist

### For DYO Items, verify:

- [ ] Cart item has `selectedMetal` (only the selected one, not all available)
- [ ] Cart item has `selectedShape` (only the selected one, not all available)
- [ ] Cart item has `selectedCarat` (only the selected one, not all available)
- [ ] Product object only has: `_id`, `productSku`, `productName`, `default_price`
- [ ] Product object does NOT have: `availableMetalTypes`, `availableShapes`, `useAllMetals`, `metadata`
- [ ] Order contains same selected values
- [ ] Order snapshot only has selected specifications

### For RTS Items, verify:

- [ ] Cart item has variant with specific `metal_type`, `shape`, `carat`
- [ ] Order snapshot only has the variant's specifications (not all product options)

---

## 🐛 Common Issues

### Issue 1: Getting all product options in response

**Problem**: Response includes `availableMetalTypes`, `availableShapes`, etc.

**Solution**: Ensure you're using the updated controllers that clean up the response.

### Issue 2: Cart shows all available options

**Problem**: When viewing cart, you see all metals/shapes, not just selected.

**Solution**: The updated code now only returns selected values. Make sure you're using the latest version.

### Issue 3: Order snapshot includes all options

**Problem**: Order itemSnapshot has all available options instead of just selected.

**Solution**: Order snapshot now only contains `specifications.metal`, `specifications.shape`, `specifications.carat` (user-selected values only).

---

## 📝 Testing Script (cURL)

Save this as `test-cart-order.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:5000"
TOKEN="YOUR_TOKEN_HERE"

# 1. Get variants
echo "=== Getting Variants ==="
curl -X GET "${BASE_URL}/api/variants?productSku=RING-001&readyToShip=true"

# 2. Add RTS to cart
echo -e "\n=== Adding RTS to Cart ==="
curl -X POST "${BASE_URL}/api/cart/rts" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "variantId": "67890abcdef12345",
    "quantity": 1
  }'

# 3. Get cart
echo -e "\n=== Getting Cart ==="
curl -X GET "${BASE_URL}/api/cart" \
  -H "Authorization: Bearer ${TOKEN}"

# 4. Add DYO to cart
echo -e "\n=== Adding DYO to Cart ==="
curl -X POST "${BASE_URL}/api/cart/dyo" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "507f1f77bcf86cd799439011",
    "selectedMetal": "18k_yellow_gold",
    "selectedShape": "Round",
    "selectedCarat": 1.5,
    "diamondId": "diamond789",
    "quantity": 1
  }'

# 5. Checkout
echo -e "\n=== Checkout ==="
curl -X POST "${BASE_URL}/api/orders/checkout" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "contactEmail": "test@example.com",
    "contactPhone": "+1234567890",
    "shippingAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "address": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "postalCode": "400001",
      "country": "India"
    },
    "paymentMethod": "Credit Card"
  }'

# 6. Get orders
echo -e "\n=== Getting Orders ==="
curl -X GET "${BASE_URL}/api/orders" \
  -H "Authorization: Bearer ${TOKEN}"
```

Make it executable:
```bash
chmod +x test-cart-order.sh
./test-cart-order.sh
```

---

## 🎯 Expected Behavior Summary

| What | Should Include | Should NOT Include |
|------|---------------|-------------------|
| **Cart Item (DYO)** | `selectedMetal`, `selectedShape`, `selectedCarat` (user choices) | `availableMetalTypes`, `availableShapes` (all options) |
| **Cart Item (RTS)** | Variant with specific `metal_type`, `shape`, `carat` | All product variants |
| **Order Item (DYO)** | Same as cart - only selected values | Product metadata with all options |
| **Order Snapshot** | `specifications.metal`, `specifications.shape` (selected only) | All available metals/shapes |
| **Product in Cart/Order** | Only: `_id`, `productSku`, `productName`, `default_price` | `metadata`, `availableMetalTypes`, `useAllMetals`, etc. |

---

**Version**: 1.0  
**Last Updated**: October 30, 2025  
**Status**: ✅ Ready for Testing

