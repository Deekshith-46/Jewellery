# Jewellery Backend - Design Your Own & Ready To Ship System

This backend implements a comprehensive jewellery e-commerce system with two main product flows:

- **Ready to Ship**: Products with existing variants that can be purchased immediately
- **Design Your Own**: Customizable products where users can select metals, shapes, carats, etc.

## 🏗️ Data Model

### Core Models

1. **Products** - Master product designs/settings
2. **Variants** - Sellable SKUs with specific configurations
3. **Metals** - Metal types with pricing rates
4. **Images** - Product and variant images
6. **Cart** - Shopping cart with variant and custom build items
7. **Order** - Order management

### Key Features

- **Compound Indexes** for fast variant lookups
- **Backward Compatibility** with existing data
- **Flexible Pricing** system for custom builds
- **Image Management** with Cloudinary integration
- **Cart System** supporting both variants and custom builds

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Create `.env` file:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/jewelrydb
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
JWT_SECRET=your_jwt_secret
```

### 3. Import Data from Excel

Place your Excel file at `data/Products_freeze (1).xlsx` and run:

```bash
npm run import:excel
```

### 4. Start Server

```bash
npm run dev
```

## 📊 Data Migration

The import script (`scripts/importFromExcel.js`) handles:

- Converting Excel rows to normalized database structure
- Creating Products, Variants, and Metals
- Preserving legacy fields for backward compatibility
- Generating unique IDs and SKUs

### Excel File Structure

Your Excel file should have a sheet named "Products" with columns like:

- `productSku` - Product identifier
- `product_name` - Product title
- `metal_type` - Metal type (14k_yellow, 18k_white, etc.)
- `shape` - Diamond shape (Round, Princess, etc.)
- `carat` - Carat weight
- `price` - Price
- `stock` - Stock quantity
- `readyToShip` - TRUE/FALSE
- `availableMetalTypes` - Comma-separated metals
- `availableShapes` - Comma-separated shapes

## 🔌 API Endpoints

### Products

#### New Endpoints (Recommended)

```bash
# List products by tab
GET /api/products/list?tab=ready|design

# Get product detail with variants and options
GET /api/products/detail/:productId
```

#### Legacy Endpoints (Backward Compatible)

```bash
# List all products
GET /api/products

# Get product by ID
GET /api/products/:id

# Get price for selection
GET /api/products/:id/price?metal=14k_yellow&quantity=1
```

### Variants

```bash
# Find variant by specifications
GET /api/admin/variants/find?productId=ring-001&metal_type=14k_yellow&carat=1.0&shape=Round

# Get variants for a product
GET /api/admin/variants/product/:productId

# Get available options for a product
GET /api/admin/variants/product/:productId/options
```

### Product Options

```bash
# Note: ProductOptions removed - all Design Your Own products use universal customization options
```

### Metals

```bash
# List metals
GET /api/admin/metals

# Calculate custom price
POST /api/admin/metals/calculate-price
```

### Cart

```bash
# Get user cart
GET /api/cart/:userId

# Add variant to cart
POST /api/cart/:userId/add
{
  "variantId": "v-101",
  "quantity": 1
}

# Add custom build to cart
POST /api/cart/:userId/add
{
  "customBuild": {
    "productId": "ring-001",
    "metal_type": "14k_yellow",
    "shape": "Round",
    "carat": 1.0,
    "price": 4200
  },
  "quantity": 1
}

# Checkout
POST /api/cart/:userId/checkout
{
  "shipping": 50,
  "taxes": 120,
  "shippingAddress": {...},
  "paymentMethod": "credit_card"
}
```

## 🎯 Frontend Integration

### Ready to Ship Flow

1. **Product Listing**: Query products with `tab=ready`
2. **Product Detail**: Get variants and build UI selectors
3. **Add to Cart**: Use `variantId` for existing variants

### Design Your Own Flow

1. **Product Listing**: Query products with `tab=design`
2. **Product Detail**: Get options and build custom UI
3. **Price Calculation**: Use metals API for pricing
4. **Add to Cart**: Use `customBuild` object

### Example Frontend Logic

```javascript
// Get product detail
const response = await fetch('/api/products/detail/ring-001');
const { product, variants, options, images } = await response.json();

if (variants.length > 0) {
  // Ready to Ship - build selectors from variants
  const metals = [...new Set(variants.map(v => v.metal_type))];
  const shapes = [...new Set(variants.map(v => v.shape))];
  const carats = [...new Set(variants.map(v => v.carat))];
} else {
  // Design Your Own - build selectors from options
  const metals = options.metal || [];
  const shapes = options.shape || [];
  const caratRanges = options.carat_range || [];
}
```

## 🔧 Admin Features

### Product Management

- Create/update products with `readyToShip` flag
- Manage variants with specific configurations
- Set up product options for customization
- Upload and manage images

### Inventory Management

- Track variant stock levels
- Update metal rates for pricing
- Manage product availability

## 📈 Performance Optimizations

- **Compound Indexes** on Variant model for fast lookups
- **Efficient Queries** with proper filtering
- **Image Optimization** with Cloudinary
- **Pagination** for large product lists

## 🛠️ Development

### Running Tests

```bash
npm test
```

### Database Seeding

```bash
npm run seed
```

### Linting

```bash
npm run lint
```

## 📝 Migration Notes

### From Legacy System

The new system maintains backward compatibility:

- Legacy fields are preserved in Product model
- Existing API endpoints continue to work
- Gradual migration path available

### Key Changes

1. **Product Model**: Added `productId`, `title`, `readyToShip` fields
2. **New Models**: Variant, Cart, Order
3. **Enhanced Controllers**: Support for both flows
4. **New Routes**: Variants, metals, cart management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For questions or issues:

1. Check the API documentation
2. Review the migration guide
3. Open an issue on GitHub

---

**Happy Coding!** 🎉
