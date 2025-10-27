# Complete Excel Setup Guide for Jewelry Application

## Overview
This guide will help you create Excel sheets to import jewelry product data into your application.

## Sheet 1: Products (Main Product Information)

### Headers (Row 1):
```
productSku | product_name | description | categories | style | main_shape | readyToShip | default_price | engravingAllowed | active
```

### Sample Data (Rows 2-4):
```
RING-001 | Classic Solitaire Ring | Timeless solitaire engagement ring | engagement,rings | classic | Round | FALSE | 2500 | TRUE | TRUE
RING-002 | Vintage Halo Ring | Art deco inspired halo ring | engagement,rings | vintage | Round | TRUE | 3200 | FALSE | TRUE
RING-003 | Modern Princess Ring | Contemporary princess cut ring | engagement,rings | modern | Princess | FALSE | 2800 | TRUE | TRUE
```

### Column Explanations:
- **productSku**: Unique identifier (like RING-001)
- **product_name**: Display name for customers
- **description**: Product description
- **categories**: Comma-separated (engagement,rings,solitaire)
- **style**: classic, vintage, modern
- **main_shape**: Primary diamond shape
- **readyToShip**: TRUE = Ready to ship, FALSE = Custom design
- **default_price**: Starting price
- **engravingAllowed**: TRUE/FALSE
- **active**: TRUE/FALSE

## Sheet 2: Variants (Product Variations)

### Headers (Row 1):
```
productSku | variant_sku | metal_type | carat | shape | diamond_type | price | stock | readyToShip | weight_metal | metal_cost | active
```

### Sample Data (Rows 2-6):
```
RING-001 | RING-001-14K-0.5 | 14k_yellow | 0.5 | Round | Natural | 2500 | 10 | TRUE | 2.5 | 150 | TRUE
RING-001 | RING-001-18K-1.0 | 18k_white | 1.0 | Round | Lab Grown | 3200 | 5 | TRUE | 3.0 | 200 | TRUE
RING-002 | RING-002-PLAT-1.5 | platinum | 1.5 | Round | Natural | 4500 | 3 | TRUE | 4.0 | 300 | TRUE
RING-003 | RING-003-14K-0.75 | 14k_yellow | 0.75 | Princess | Natural | 2800 | 8 | TRUE | 2.8 | 180 | TRUE
RING-003 | RING-003-18K-1.25 | 18k_white | 1.25 | Princess | Lab Grown | 3600 | 4 | TRUE | 3.2 | 220 | TRUE
```

### Column Explanations:
- **productSku**: Links to main product
- **variant_sku**: Unique SKU for this specific variant
- **metal_type**: 14k_yellow, 18k_white, platinum
- **carat**: Diamond carat weight (0.5, 1.0, 1.5, etc.)
- **shape**: Round, Princess, Oval, etc.
- **diamond_type**: Natural or Lab Grown
- **price**: Price for this specific variant
- **stock**: Available quantity
- **weight_metal**: Metal weight in grams
- **metal_cost**: Cost of metal

## Sheet 3: ~~ProductOptions~~ (NOT NEEDED)

**Note**: ProductOptions sheet is not needed because every "Design Your Own" product shows the same customization options to all customers. The frontend handles all available metals, shapes, and carat ranges universally.

## Sheet 3: Metals (Metal Pricing)

### Headers (Row 1):
```
metal_type | rate_per_gram | price_multiplier
```

### Sample Data (Rows 2-4):
```
14k_yellow | 45.50 | 1.2
18k_white | 52.75 | 1.3
platinum | 89.25 | 1.5
```

### Field Explanations:
- **metal_type**: 14k_yellow, 18k_white, platinum
- **rate_per_gram**: Current price per gram (admin updates daily)
- **price_multiplier**: Multiplier for final price calculation

### Important Notes:
- **Only 1 record per metal type** - existing records are updated, not duplicated
- **Daily updates** - upload new Excel sheet to update metal rates
- **No duplicates** - system maintains single record per metal type

## Sheet 4: Images (Product Images)

### Headers (Row 1):
```
productSku | variant_sku | image_url | image_type | alt_text | sort_order | active
```

### Sample Data (Rows 2-5):
```
RING-001 | | https://example.com/ring001-main.jpg | main | Classic solitaire ring main view | 1 | TRUE
RING-001 | | https://example.com/ring001-detail.jpg | detail | Classic solitaire ring detail view | 2 | TRUE
RING-001 | RING-001-14K-0.5 | https://example.com/ring001-14k.jpg | main | 14K yellow gold solitaire ring | 1 | TRUE
RING-002 | | https://example.com/ring002-main.jpg | main | Vintage halo ring main view | 1 | TRUE
```

## How to Use These Sheets:

1. **Create Excel file** with 5 sheets named exactly as above
2. **Add headers** in row 1 of each sheet
3. **Fill in your data** starting from row 2
4. **Save as Excel file** (.xlsx)
5. **Place file** in your project's `data` folder
6. **Run import script** to load data into your application

## Important Notes:

- Use **TRUE/FALSE** (not true/false) for boolean values
- Use **comma-separated** values without spaces: `14k_yellow,18k_white,platinum`
- Keep **SKUs unique** across all sheets
- **productSku** links sheets together
- Use **consistent naming** for metal types and shapes
