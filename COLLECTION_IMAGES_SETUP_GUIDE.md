# Collection Images Setup Guide - Step by Step

This guide shows how to add the 5 collection images for the "Explore Our Collections" section.

## Prerequisites

1. **Admin Authentication**: You need a valid admin JWT token
2. **Base URL**: `http://localhost:5000/api/admin/images/collections` (or your server URL)
3. **Headers**: Include `Authorization: Bearer YOUR_ADMIN_TOKEN`

## Image Categories

Based on the design, you need to add images for these categories:
1. **Engagement Rings** (main large image)
2. **Bracelet** (regular grid image)
3. **Necklace** (regular grid image)
4. **Diamonds** (regular grid image)
5. **Fine Jewellery** (regular grid image)

---

## Step 1: Add Main Image - Engagement Rings

This is the large featured image on the left side.

### Option A: Using File Upload (Form-Data)

```bash
POST /api/admin/images/collections
Content-Type: multipart/form-data
Authorization: Bearer YOUR_ADMIN_TOKEN

Form Data:
- image: [upload your engagement rings image file]
- category: "engagement-rings"
- display_text: "Engagement Rings"
- image_type: "main"
- alt_text: "Engagement Rings Collection"
- link_url: "/products?category=engagement-rings" (optional)
```

### Option B: Using JSON with URL

```bash
POST /api/admin/images/collections
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "category": "engagement-rings",
  "display_text": "Engagement Rings",
  "image_type": "main",
  "image_url": "https://your-image-url.com/engagement-rings-main.jpg",
  "alt_text": "Engagement Rings Collection",
  "link_url": "/products?category=engagement-rings"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/admin/images/collections \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "engagement-rings",
    "display_text": "Engagement Rings",
    "image_type": "main",
    "image_url": "https://your-image-url.com/engagement-rings-main.jpg",
    "alt_text": "Engagement Rings Collection",
    "link_url": "/products?category=engagement-rings"
  }'
```

---

## Step 2: Add Regular Image - Bracelet

This is the first smaller image in the top row.

### Option A: Using File Upload (Form-Data)

```bash
POST /api/admin/images/collections
Content-Type: multipart/form-data
Authorization: Bearer YOUR_ADMIN_TOKEN

Form Data:
- image: [upload your bracelet image file]
- category: "bracelet"
- display_text: "Bracelet"
- image_type: "regular"
- alt_text: "Bracelet Collection"
- link_url: "/products?category=bracelet"
- sort_order: 0
```

### Option B: Using JSON with URL

```bash
POST /api/admin/images/collections
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "category": "bracelet",
  "display_text": "Bracelet",
  "image_type": "regular",
  "image_url": "https://your-image-url.com/bracelet.jpg",
  "alt_text": "Bracelet Collection",
  "link_url": "/products?category=bracelet",
  "sort_order": 0
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/admin/images/collections \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "bracelet",
    "display_text": "Bracelet",
    "image_type": "regular",
    "image_url": "https://your-image-url.com/bracelet.jpg",
    "alt_text": "Bracelet Collection",
    "link_url": "/products?category=bracelet",
    "sort_order": 0
  }'
```

---

## Step 3: Add Regular Image - Necklace

This is the second smaller image in the top row.

```bash
POST /api/admin/images/collections
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "category": "necklace",
  "display_text": "Necklace",
  "image_type": "regular",
  "image_url": "https://your-image-url.com/necklace.jpg",
  "alt_text": "Necklace Collection",
  "link_url": "/products?category=necklace",
  "sort_order": 1
}
```

---

## Step 4: Add Regular Image - Diamonds

This is the first smaller image in the bottom row.

```bash
POST /api/admin/images/collections
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "category": "diamonds",
  "display_text": "Diamonds",
  "image_type": "regular",
  "image_url": "https://your-image-url.com/diamonds.jpg",
  "alt_text": "Diamonds Collection",
  "link_url": "/products?category=diamonds",
  "sort_order": 2
}
```

---

## Step 5: Add Regular Image - Fine Jewellery

This is the second smaller image in the bottom row.

```bash
POST /api/admin/images/collections
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "category": "fine-jewellery",
  "display_text": "Fine Jewellery",
  "image_type": "regular",
  "image_url": "https://your-image-url.com/fine-jewellery.jpg",
  "alt_text": "Fine Jewellery Collection",
  "link_url": "/products?category=fine-jewellery",
  "sort_order": 3
}
```

---

## Alternative: Add Multiple Images at Once

You can add multiple regular images in a single request:

```bash
POST /api/admin/images/collections
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "category": "bracelet",
  "display_text": "Bracelet",
  "image_type": "regular",
  "image_urls": [
    "https://your-image-url.com/bracelet1.jpg",
    "https://your-image-url.com/bracelet2.jpg"
  ],
  "alt_text": "Bracelet Collection",
  "link_url": "/products?category=bracelet"
}
```

**Note:** The API will automatically assign `sort_order` values sequentially.

---

## Verify Your Images

After adding all images, verify they were created correctly:

### List All Collection Images

```bash
GET /api/admin/images/collections
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### List Images for a Specific Category

```bash
GET /api/admin/images/collections?category=engagement-rings
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### Get Main Image Only

```bash
GET /api/admin/images/collections?image_type=main
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### Get Regular Images Only

```bash
GET /api/admin/images/collections?image_type=regular
Authorization: Bearer YOUR_ADMIN_TOKEN
```

---

## Postman Collection Examples

### Example 1: Add Engagement Rings (Main Image)

**Method:** POST  
**URL:** `http://localhost:5000/api/admin/images/collections`  
**Headers:**
```
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "category": "engagement-rings",
  "display_text": "Engagement Rings",
  "image_type": "main",
  "image_url": "https://res.cloudinary.com/your-cloud/image/upload/v1/engagement-rings-main.jpg",
  "alt_text": "Engagement Rings Collection",
  "link_url": "/products?category=engagement-rings"
}
```

### Example 2: Add Bracelet (Regular Image) with File Upload

**Method:** POST  
**URL:** `http://localhost:5000/api/admin/images/collections`  
**Headers:**
```
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: multipart/form-data
```

**Body (Form-Data):**
```
image: [Select File] bracelet.jpg
category: bracelet
display_text: Bracelet
image_type: regular
alt_text: Bracelet Collection
link_url: /products?category=bracelet
sort_order: 0
```

---

## Quick Setup Script (All 5 Images)

Here's a complete example using cURL to add all 5 images:

```bash
# 1. Engagement Rings (Main)
curl -X POST http://localhost:5000/api/admin/images/collections \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "engagement-rings",
    "display_text": "Engagement Rings",
    "image_type": "main",
    "image_url": "https://your-image-url.com/engagement-rings-main.jpg",
    "alt_text": "Engagement Rings Collection",
    "link_url": "/products?category=engagement-rings"
  }'

# 2. Bracelet
curl -X POST http://localhost:5000/api/admin/images/collections \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "bracelet",
    "display_text": "Bracelet",
    "image_type": "regular",
    "image_url": "https://your-image-url.com/bracelet.jpg",
    "alt_text": "Bracelet Collection",
    "link_url": "/products?category=bracelet",
    "sort_order": 0
  }'

# 3. Necklace
curl -X POST http://localhost:5000/api/admin/images/collections \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "necklace",
    "display_text": "Necklace",
    "image_type": "regular",
    "image_url": "https://your-image-url.com/necklace.jpg",
    "alt_text": "Necklace Collection",
    "link_url": "/products?category=necklace",
    "sort_order": 1
  }'

# 4. Diamonds
curl -X POST http://localhost:5000/api/admin/images/collections \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "diamonds",
    "display_text": "Diamonds",
    "image_type": "regular",
    "image_url": "https://your-image-url.com/diamonds.jpg",
    "alt_text": "Diamonds Collection",
    "link_url": "/products?category=diamonds",
    "sort_order": 2
  }'

# 5. Fine Jewellery
curl -X POST http://localhost:5000/api/admin/images/collections \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "fine-jewellery",
    "display_text": "Fine Jewellery",
    "image_type": "regular",
    "image_url": "https://your-image-url.com/fine-jewellery.jpg",
    "alt_text": "Fine Jewellery Collection",
    "link_url": "/products?category=fine-jewellery",
    "sort_order": 3
  }'
```

---

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | String | ✅ Yes | Category identifier (e.g., "engagement-rings", "bracelet") |
| `display_text` | String | ✅ Yes | Text to display below the image (e.g., "Engagement Rings") |
| `image_type` | String | No | "main" (large featured) or "regular" (default: "regular") |
| `image_url` | String | ✅ Yes* | Image URL (required if no file upload) |
| `image_urls` | Array | ✅ Yes* | Array of image URLs (for multiple images) |
| `alt_text` | String | No | Alt text for accessibility |
| `link_url` | String | No | URL where clicking the image navigates |
| `sort_order` | Number | No | Display order (auto-assigned if not provided) |
| `metadata` | Object | No | Additional metadata (JSON object) |

*Either `image_url`/`image_urls` OR file upload via form-data is required.

---

## Important Notes

1. **Main Image Limit**: Only **one main image** per category is allowed. If you try to add another main image for the same category, it will update the existing one instead of creating a duplicate.

2. **Sort Order**: 
   - Main images always have `sort_order: 0`
   - Regular images are auto-assigned sequential sort orders if not specified
   - You can manually set `sort_order` to control display sequence

3. **File Upload**: When uploading files via form-data, they are automatically uploaded to Cloudinary in the `collections` folder.

4. **Category Names**: Use lowercase with hyphens (e.g., "engagement-rings", "fine-jewellery") for consistency.

5. **Display Order**: Regular images are displayed in order of `sort_order` (ascending).

---

## Troubleshooting

### Error: "Category is required"
- Make sure you're including the `category` field in your request

### Error: "Display text is required"
- Make sure you're including the `display_text` field in your request

### Error: "Only one main image is allowed per category"
- You're trying to add a second main image for a category that already has one
- Either update the existing main image or use `image_type: "regular"`

### Error: "Either upload image file(s) via form-data or provide image_url/image_urls"
- You need to either upload a file OR provide a URL
- Make sure your file upload is in the correct field name (`image` or `images`)

