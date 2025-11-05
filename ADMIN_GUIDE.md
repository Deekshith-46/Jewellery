# 👨‍💼 Admin Guide - Managing RTS & DYO Products

## 📋 Table of Contents

1. [Managing Metal Prices](#managing-metal-prices)
2. [Managing Products](#managing-products)
3. [Managing RTS Variants](#managing-rts-variants)
4. [Managing Diamonds](#managing-diamonds)
5. [Order Management](#order-management)
6. [Updating Payment Status](#updating-payment-status)

---

## Managing Metal Prices

Metal prices are used for **DYO price calculations** and should be updated daily based on market rates.

### View All Metals

**Admin Endpoint**: `GET /api/admin/metals`

```json
{
  "success": true,
  "metals": [
    {
      "metal_type": "14k_white_gold",
      "rate_per_gram": 5600,
      "price_multiplier": 1.15
    }
  ]
}
```

### Update Metal Rate

**Admin Endpoint**: `PUT /api/admin/metals/:metalId`

**Request Body**:
```json
{
  "rate_per_gram": 5800,
  "price_multiplier": 1.15
}
```

**Important**: When you update metal rates, **existing cart items keep their old prices** (they were calculated when added to cart). Only **new cart additions** will use the updated rates.

---

## Managing Products

### Create New Product

**Admin Endpoint**: `POST /api/admin/products`

**For RTS Product**:
```json
{
  "productSku": "RING-003",
  "productName": "Classic Diamond Ring",
  "title": "Classic Diamond Ring",
  "readyToShip": true,
  "default_price": null,
  "categories": ["engagement", "classic"],
  "style": "classic",
  "main_shape": "Round",
  "description": "Timeless classic design",
  "engravingAllowed": true,
  "active": true
}
```

**For DYO Product**:
```json
{
  "productSku": "RING-004",
  "productName": "Custom Halo Ring",
  "title": "Custom Halo Ring",
  "readyToShip": false,
  "default_price": 15000,
  "metadata": {
    "metal_weight": 6.5
  },
  "categories": ["engagement", "halo"],
  "style": "modern",
  "description": "Customizable halo design",
  "engravingAllowed": true,
  "active": true
}
```

**Key Fields Explained**:

| Field | Description | RTS | DYO |
|-------|-------------|-----|-----|
| `readyToShip` | `true` for RTS, `false` for DYO | ✅ `true` | ✅ `false` |
| `default_price` | Setting/labor price | Not needed (use variant price) | **Required** (base setting price) |
| `metadata.metal_weight` | Metal weight in grams | Not needed | **Important** for price calculation |

### Update Product

**Admin Endpoint**: `PUT /api/admin/products/:productId`

```json
{
  "default_price": 16000,
  "metadata": {
    "metal_weight": 7.0
  }
}
```

**Note**: Changing `default_price` or `metal_weight` will affect **new cart additions only**. Existing orders retain their original prices.

---

## Managing RTS Variants

RTS products require **variants** with fixed prices.

### Create RTS Variant

**Admin Endpoint**: `POST /api/admin/variants`

```json
{
  "productSku": "RING-003",
  "variant_sku": "RING-003-18Y-2.0-OVL",
  "metal_type": "18k_yellow_gold",
  "shape": "Oval",
  "carat": 2.0,
  "price": 95000,
  "stock": 5,
  "readyToShip": true,
  "active": true
}
```

**Price Calculation for RTS**:
```
Total Price = Metal Cost + Diamond Cost + Setting Cost + Markup
```

You set the **final price manually** in the variant. The system doesn't recalculate.

### Update Stock

**Admin Endpoint**: `PUT /api/admin/variants/:variantId`

```json
{
  "stock": 8
}
```

**Auto Stock Updates**:
- ✅ Stock **decreases** when order is placed
- ✅ Stock **increases** when order is cancelled

---

## Managing Diamonds

### Add New Diamond

**Admin Endpoint**: `POST /api/admin/diamonds`

```json
{
  "sku": "DIA-RND-200-IF-D",
  "shape": "Round",
  "carat": 2.0,
  "cut": "Excellent",
  "color": "D",
  "clarity": "IF",
  "price": 120000,
  "available": true,
  "active": true
}
```

### Update Diamond Price

**Admin Endpoint**: `PUT /api/admin/diamonds/:diamondId`

```json
{
  "price": 125000,
  "available": true
}
```

**Note**: Price changes affect **new cart additions only**. Existing cart items and orders keep their original diamond prices.

---

## Order Management

### View All Orders

**Admin Endpoint**: `GET /api/admin/orders`

**Query Parameters**:
- `?status=Pending` - Filter by order status
- `?paymentStatus=Paid` - Filter by payment status
- `?isPaid=true` - Filter paid orders
- `?page=1&limit=20` - Pagination

**Response**:
```json
{
  "success": true,
  "orders": [
    {
      "orderId": "ORD-1698765432000-A1B2C3",
      "userId": {...},
      "items": [
        {
          "itemType": "dyo",
          "productSku": "RING-002",
          "priceBreakdown": {
            "metal_cost": 39600,
            "diamond_price": 35000,
            "setting_price": 12000,
            "metal_weight": 5.5
          },
          "totalPrice": 86600
        }
      ],
      "total": 95110,
      "status": "Pending",
      "paymentStatus": "Pending",
      "isPaid": false,
      "createdAt": "2025-10-30T10:00:00.000Z"
    }
  ]
}
```

### Understanding Order Items

#### RTS Order Item
```json
{
  "itemType": "rts",
  "variant_sku": "RING-001-14W-1.5-RND",
  "quantity": 1,
  "pricePerItem": 45000,
  "totalPrice": 45000,
  "itemSnapshot": {
    "title": "RING-001",
    "specifications": {
      "metal_type": "14k_white_gold",
      "shape": "Round",
      "carat": 1.5
    }
  }
}
```

#### DYO Order Item
```json
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
      "priceBreakdown": {...}
    }
  }
}
```

### Update Order Status

**Admin Endpoint**: `PUT /api/admin/orders/:orderId`

```json
{
  "status": "Processing",
  "trackingNumber": "1Z999AA10123456784",
  "estimatedDelivery": "2025-11-05",
  "adminNotes": "Custom engraving completed"
}
```

**Order Status Flow**:
```
Pending → Confirmed → Processing → Shipped → Delivered
         ↓
    Cancelled (only if Pending)
```

### Update Shipping Information

**Admin Endpoint**: `PUT /api/admin/orders/:orderId`

```json
{
  "status": "Shipped",
  "shippingMethod": "FedEx Express",
  "trackingNumber": "1Z999AA10123456784",
  "estimatedDelivery": "2025-11-05T17:00:00.000Z"
}
```

---

## Updating Payment Status

### Manual Payment Confirmation

**Admin Endpoint**: `PUT /api/admin/orders/:orderId`

```json
{
  "paymentStatus": "Paid",
  "isPaid": true,
  "transactionId": "MANUAL-20251030-001"
}
```

### Via Payment Gateway Webhook

**Public Endpoint**: `PUT /api/orders/:orderId/payment-status`

This endpoint is automatically called by payment gateways (Razorpay, Stripe, etc.) when payment succeeds.

**Request Body** (from webhook):
```json
{
  "paymentStatus": "Paid",
  "transactionId": "txn_1234567890",
  "isPaid": true
}
```

**Automatic Actions**:
- ✅ Sets `isPaid = true`
- ✅ Sets `paidAt = current timestamp`
- ✅ Auto-updates `status` from "Pending" to "Confirmed"

### Payment Status Values

| Status | Description |
|--------|-------------|
| `Pending` | Awaiting payment |
| `Paid` | Payment successful |
| `Failed` | Payment failed |
| `Refunded` | Full refund issued |
| `Partially Refunded` | Partial refund issued |

### Quick Filter: Find Unpaid Orders

**Admin Query**:
```
GET /api/admin/orders?isPaid=false&status=Pending
```

---

## Price History & Transparency

### Why Store Price Breakdown?

**For DYO items**, we store:
```json
"priceBreakdown": {
  "metal_cost": 39600,
  "diamond_price": 35000,
  "setting_price": 12000,
  "metal_weight": 5.5
}
```

**Benefits**:
1. ✅ **Customer Transparency** - Customer can see exactly how their price was calculated
2. ✅ **Price History** - Even if metal or diamond prices change later, order keeps original breakdown
3. ✅ **Dispute Resolution** - Clear record of pricing at time of purchase
4. ✅ **Analytics** - Track average metal cost, diamond cost, setting cost across orders

### Viewing Customer's Perspective

When a customer views their order, they see:

```
Order #ORD-1698765432000-A1B2C3

Custom Engagement Ring
  Metal (18K Yellow Gold, 5.5g): ₹39,600
  Diamond (1.5ct Round VVS1 D): ₹35,000
  Setting & Labor: ₹12,000
  ────────────────────────────────
  Item Total: ₹86,600

Subtotal: ₹86,600
Shipping: ₹500
Taxes: ₹7,794
────────────────
Total: ₹94,894

Payment Status: Paid ✅
```

---

## Daily Admin Workflow

### Morning Routine
1. **Update Metal Rates**
   ```
   GET latest rates from market
   → PUT /api/admin/metals/:metalId (update each metal)
   ```

2. **Check Pending Orders**
   ```
   GET /api/admin/orders?status=Pending&isPaid=false
   ```

3. **Process Paid Orders**
   ```
   GET /api/admin/orders?isPaid=true&status=Confirmed
   → Begin production
   → PUT /api/admin/orders/:orderId (update to "Processing")
   ```

### Throughout the Day
1. **Monitor Stock Levels**
   ```
   GET /api/admin/variants?stock[lte]=2
   (Find variants with low stock)
   ```

2. **Update Shipping Info**
   ```
   For shipped orders:
   → PUT /api/admin/orders/:orderId
     {
       status: "Shipped",
       trackingNumber: "...",
       estimatedDelivery: "..."
     }
   ```

---

## Important Notes

### Price Locking
- ✅ Prices are **locked** when items are added to cart
- ✅ Updating metal/diamond prices does **NOT** affect existing cart items or orders
- ✅ Each order stores a **complete snapshot** of item details and prices

### Stock Management
- ✅ Only **RTS items** have stock tracking
- ✅ **DYO items** are made-to-order (no stock limits)
- ✅ Stock auto-decrements on order placement
- ✅ Stock auto-increments on order cancellation

### Payment Flow
```
Order Created (isPaid=false, status=Pending)
    ↓
Payment Gateway Webhook
    ↓
isPaid=true, paidAt=now, status=Confirmed
    ↓
Admin processes order (status=Processing)
    ↓
Admin ships order (status=Shipped)
    ↓
Customer receives (status=Delivered)
```

---

## Troubleshooting

### Customer can't checkout - "Insufficient stock"
**Solution**: Check RTS variant stock
```
GET /api/admin/variants/:variantId
→ Increase stock if available
→ PUT /api/admin/variants/:variantId { stock: 10 }
```

### Price looks wrong in order
**Solution**: Check price breakdown
```
GET /api/admin/orders/:orderId
→ View "priceBreakdown" in order item
→ Verify metal_cost, diamond_price, setting_price
```

### Payment confirmed but order still "Pending"
**Solution**: Manually update payment status
```
PUT /api/admin/orders/:orderId
{
  "paymentStatus": "Paid",
  "isPaid": true,
  "transactionId": "MANUAL-..."
}
→ Order will auto-update to "Confirmed"
```

---

## Admin API Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/products` | GET, POST, PUT | Manage products |
| `/api/admin/variants` | GET, POST, PUT | Manage RTS variants |
| `/api/admin/diamonds` | GET, POST, PUT | Manage diamonds |
| `/api/admin/metals` | GET, PUT | Update metal rates |
| `/api/admin/orders` | GET, PUT | View and update orders |

---

**Version**: 1.0  
**Last Updated**: October 30, 2025  
**For**: Admin Users

