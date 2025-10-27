# Images Excel Sheet Creation Guide

## 📊 **Images Sheet Structure**

### **Headers (Row 1):**
```
productSku | variant_sku | image_url | alt_text | active
```

### **Column Descriptions:**

| Column | Data Type | Required | Description | Example |
|--------|-----------|----------|-------------|---------|
| `productSku` | Text | Yes | Links to main product | `RING-001` |
| `variant_sku` | Text | No | Links to specific variant (optional) | `RING-001-14K-0.5` |
| `image_url` | Text | Yes | Full URL to image | `https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ring001-main.jpg` |
| `alt_text` | Text | No | Description for accessibility | `Classic solitaire ring main view` |
| `active` | Boolean | Yes | Image status | `TRUE` or `FALSE` |

---

## 🎯 **Sample Data for Images Sheet**

### **Example 1: Product with 2 Images**
```
RING-001 | | https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ring001-main.jpg | Classic solitaire ring main view | TRUE
RING-001 | | https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ring001-detail.jpg | Classic solitaire ring detail view | TRUE
```

### **Example 2: Product with Multiple Images**
```
RING-002 | | https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ring002-hero.jpg | Vintage halo ring hero image | TRUE
RING-002 | | https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ring002-gallery1.jpg | Vintage halo ring gallery view 1 | TRUE
RING-002 | | https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ring002-gallery2.jpg | Vintage halo ring gallery view 2 | TRUE
RING-002 | | https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ring002-360.jpg | Vintage halo ring 360 view | TRUE
```

### **Example 3: Variant-Specific Images**
```
RING-001 | RING-001-14K-0.5 | https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ring001-14k-main.jpg | 14K yellow gold solitaire ring | TRUE
RING-001 | RING-001-18K-1.0 | https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ring001-18k-main.jpg | 18K white gold solitaire ring | TRUE
```

---

## 📋 **Step-by-Step Creation Guide**

### **Step 1: Create Excel Sheet**
1. Open Google Sheets or Excel
2. Name the sheet "Images"
3. Add headers in row 1 (as shown above)

### **Step 2: Add Your Data**
For each product, add 2 images minimum:

**Row 2 (First Image):**
- `productSku`: Your product SKU (e.g., RING-001)
- `variant_sku`: Leave empty (for product-level images)
- `image_url`: Your image URL
- `alt_text`: Description of the image
- `active`: `TRUE`

**Row 3 (Second Image):**
- `productSku`: Same product SKU (e.g., RING-001)
- `variant_sku`: Leave empty
- `image_url`: Your second image URL
- `alt_text`: Description of the second image
- `active`: `TRUE`

### **Step 3: Complete Example for 3 Products**

```
productSku | variant_sku | image_url | alt_text | active
RING-001 | | https://example.com/ring001-main.jpg | Classic solitaire ring main view | TRUE
RING-001 | | https://example.com/ring001-detail.jpg | Classic solitaire ring detail view | TRUE
RING-002 | | https://example.com/ring002-hero.jpg | Vintage halo ring hero image | TRUE
RING-002 | | https://example.com/ring002-gallery.jpg | Vintage halo ring gallery view | TRUE
RING-003 | | https://example.com/ring003-main.jpg | Modern princess ring main view | TRUE
RING-003 | | https://example.com/ring003-detail.jpg | Modern princess ring detail view | TRUE
```

---

## 🔧 **Important Notes:**

1. **Image URLs**: Use full URLs (https://) to your image hosting service
2. **Active Status**: Use `TRUE` for active images, `FALSE` for hidden images
3. **Variant Images**: Only use `variant_sku` if the image is specific to a variant
4. **Alt Text**: Important for accessibility and SEO

## 📁 **File Structure:**
- Save as Excel file (.xlsx)
- Place in your project's `data` folder
- Name it something like `Images.xlsx`

This structure will give you 2 images per product as requested, with proper organization and metadata!
