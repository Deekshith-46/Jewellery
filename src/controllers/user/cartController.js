const mongoose = require('mongoose');
const Cart = require('../../models/user/Cart');
const Variant = require('../../models/admin/Variant');
const Product = require('../../models/admin/Product');
const DiamondSpec = require('../../models/admin/DiamondSpec');
const Metal = require('../../models/admin/Metal');

/**
 * Get user's cart
 * GET /api/cart
 */
exports.getCart = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    let cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.variant',
        select: 'variant_sku productSku metal_type shape carat price stock active'
      })
      .populate({
        path: 'items.product',
        select: 'productSku productName title default_price description main_shape style active'
      })
      .populate({
        path: 'items.selectedDiamond',
        select: 'sku shape carat cut color purity polish symmetry fluorescence price pricePerCarat certNumber certUrl imageUrl videoUrl measurement ratio lab available active',
        populate: {
          path: 'shape',
          select: 'code label'
        }
      })
      .lean();
    
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }
    
    // Clean up response - ensure only selected values are returned
    // Remove any full product objects with all available options
    if (cart.items) {
      cart.items = cart.items.map(item => {
        if (item.itemType === 'dyo' && item.product) {
          // Return product info (but not all available options like availableMetalTypes)
          item.product = {
            _id: item.product._id,
            productSku: item.product.productSku,
            productName: item.product.productName || item.product.title,
            default_price: item.product.default_price,
            description: item.product.description,
            main_shape: item.product.main_shape,
            style: item.product.style
          };
          // Ensure only selected values are visible
          // selectedMetal, selectedShape, selectedCarat are already correct
        }
        return item;
      });
    }
    
    res.json({
      success: true,
      cart
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Add Ready-to-Ship (RTS) item to cart
 * POST /api/cart/rts
 */
exports.addRTSToCart = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { variant_sku, variantId, quantity = 1, engraving, specialInstructions } = req.body;
    
    if (!variant_sku && !variantId) {
      return res.status(400).json({ 
        success: false,
        message: 'variant_sku or variantId is required' 
      });
    }
    
    // Find variant
    let variant;
    if (variantId && mongoose.Types.ObjectId.isValid(variantId)) {
      variant = await Variant.findById(variantId);
    } else if (variant_sku) {
      variant = await Variant.findOne({ variant_sku });
    }
    
    if (!variant) {
      return res.status(404).json({ 
        success: false,
        message: 'Variant not found' 
      });
    }
    
    if (!variant.active) {
      return res.status(400).json({ 
        success: false,
        message: 'This variant is not available' 
      });
    }
    
    if (variant.stock < quantity) {
      return res.status(400).json({ 
        success: false,
        message: `Only ${variant.stock} items available in stock` 
      });
    }
    
    // Get or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
    
    // Check if variant already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.itemType === 'rts' && 
              item.variant && 
              item.variant.toString() === variant._id.toString()
    );
    
    const pricePerItem = variant.price || 0;
    const qty = Number(quantity);
    const totalPrice = pricePerItem * qty;
    
    if (existingItemIndex >= 0) {
      // Update existing item
      const newQty = cart.items[existingItemIndex].quantity + qty;
      
      if (variant.stock < newQty) {
        return res.status(400).json({ 
          success: false,
          message: `Cannot add more. Only ${variant.stock} items available in stock` 
        });
      }
      
      cart.items[existingItemIndex].quantity = newQty;
      cart.items[existingItemIndex].totalPrice = pricePerItem * newQty;
      if (engraving) cart.items[existingItemIndex].engraving = engraving;
      if (specialInstructions) cart.items[existingItemIndex].specialInstructions = specialInstructions;
    } else {
      // Add new item
      cart.items.push({
        itemType: 'rts',
        variant: variant._id,
        variant_sku: variant.variant_sku,
        quantity: qty,
        pricePerItem,
        totalPrice,
        engraving,
        specialInstructions
      });
    }
    
    await cart.save();
    
    // Populate and return - only selected fields
    cart = await Cart.findById(cart._id)
      .populate('items.variant', 'variant_sku productSku metal_type shape carat price stock')
      .populate('items.product', 'productSku productName title default_price') // Minimal product info
      .populate('items.selectedDiamond', 'sku shape carat cut color clarity price')
      .lean();
    
    // Clean up - ensure only selected values are returned
    if (cart.items) {
      cart.items = cart.items.map(item => {
        if (item.itemType === 'dyo' && item.product) {
          // Only return minimal product info, not full product with all options
          item.product = {
            _id: item.product._id,
            productSku: item.product.productSku,
            productName: item.product.productName || item.product.title,
            default_price: item.product.default_price
          };
        }
        return item;
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      cart
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Add Design-Your-Own (DYO) item to cart
 * POST /api/cart/dyo
 */
exports.addDYOToCart = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { 
      productSku, 
      productId,
      selectedMetal, 
      selectedShape, 
      selectedCarat,
      diamondSku,
      diamondId,
      quantity = 1,
      engraving,
      specialInstructions
    } = req.body;
    
    if (!productSku && !productId) {
      return res.status(400).json({ 
        success: false,
        message: 'productSku or productId is required' 
      });
    }
    
    // Find product
    let product;
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    } else if (productSku) {
      product = await Product.findOne({ productSku });
    }
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }
    
    if (!product.active) {
      return res.status(400).json({ 
        success: false,
        message: 'This product is not available' 
      });
    }
    
    // Find diamond if specified
    let diamond = null;
    if (diamondId || diamondSku) {
      if (diamondId && mongoose.Types.ObjectId.isValid(diamondId)) {
        diamond = await DiamondSpec.findById(diamondId);
      } else if (diamondSku) {
        diamond = await DiamondSpec.findOne({ sku: diamondSku });
      }
      
      if (!diamond) {
        return res.status(404).json({ 
          success: false,
          message: 'Diamond not found' 
        });
      }
      
      if (!diamond.active || !diamond.available) {
        return res.status(400).json({ 
          success: false,
          message: 'Selected diamond is not available' 
        });
      }
    }
    
    // Calculate price with detailed breakdown for DYO items
    const diamond_price = diamond ? (diamond.price || 0) : 0;
    let metal_cost = 0;
    let metal_weight = 0;
    
    // Calculate metal cost if metal is selected
    if (selectedMetal) {
      // Try to find metal by metal_type (exact match or normalized)
      let metal = await Metal.findOne({ metal_type: selectedMetal });
      
      // If not found, try case-insensitive search
      if (!metal) {
        metal = await Metal.findOne({ 
          metal_type: { $regex: new RegExp(`^${selectedMetal}$`, 'i') } 
        });
      }
      
      if (metal) {
        // Get metal weight from product metadata or use default
        metal_weight = product.metadata?.metal_weight || product.metadata?.weight || 5; // default 5g if not specified
        metal_cost = (metal.rate_per_gram || 0) * metal_weight;
      } else {
        console.warn(`Metal not found: ${selectedMetal}`);
      }
    }
    
    // Total price per item = metal + diamond (setting_price removed)
    const pricePerItem = metal_cost + diamond_price;
    const qty = Number(quantity);
    const totalPrice = pricePerItem * qty;
    
    // Price breakdown for DYO items
    const priceBreakdown = {
      metal_cost,
      diamond_price,
      metal_weight
    };
    
    // Get or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
    
    // Add new DYO item (each DYO is unique)
    cart.items.push({
      itemType: 'dyo',
      product: product._id,
      productSku: product.productSku,
      selectedMetal,
      selectedShape,
      selectedCarat: selectedCarat ? Number(selectedCarat) : undefined,
      selectedDiamond: diamond ? diamond._id : undefined,
      diamondSku: diamond ? diamond.sku : undefined,
      quantity: qty,
      pricePerItem,
      totalPrice,
      priceBreakdown,
      engraving,
      specialInstructions
    });
    
    await cart.save();
    
    // Populate and return - only selected fields
    cart = await Cart.findById(cart._id)
      .populate('items.variant', 'variant_sku productSku metal_type shape carat price')
      .populate('items.product', 'productSku productName title default_price description main_shape style') // Product info
      .populate({
        path: 'items.selectedDiamond',
        select: 'sku shape carat cut color purity polish symmetry fluorescence price pricePerCarat certNumber certUrl imageUrl videoUrl measurement ratio lab',
        populate: {
          path: 'shape',
          select: 'code label'
        }
      })
      .lean();
    
    // Clean up - ensure only selected values are returned
    if (cart.items) {
      cart.items = cart.items.map(item => {
        if (item.itemType === 'dyo' && item.product) {
          // Only return minimal product info, not full product with all options
          item.product = {
            _id: item.product._id,
            productSku: item.product.productSku,
            productName: item.product.productName || item.product.title,
            default_price: item.product.default_price
          };
        }
        return item;
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Custom item added to cart',
      cart
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Update cart item quantity
 * PUT /api/cart/items/:itemId
 */
exports.updateCartItem = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid item ID' 
      });
    }
    
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ 
        success: false,
        message: 'Cart not found' 
      });
    }
    
    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: 'Item not found in cart' 
      });
    }
    
    const newQty = Number(quantity);
    
    if (newQty <= 0) {
      // Remove item
      cart.items.pull(itemId);
    } else {
      // Check stock for RTS items
      if (item.itemType === 'rts' && item.variant) {
        const variant = await Variant.findById(item.variant);
        if (variant && variant.stock < newQty) {
          return res.status(400).json({ 
            success: false,
            message: `Only ${variant.stock} items available in stock` 
          });
        }
      }
      
      // Update quantity and total price
      item.quantity = newQty;
      item.totalPrice = item.pricePerItem * newQty;
    }
    
    await cart.save();
    
    // Populate and return - only selected fields
    const updatedCart = await Cart.findById(cart._id)
      .populate('items.variant', 'variant_sku productSku metal_type shape carat price stock')
      .populate('items.product', 'productSku productName title default_price description main_shape style')
      .populate({
        path: 'items.selectedDiamond',
        select: 'sku shape carat cut color purity polish symmetry fluorescence price pricePerCarat certNumber certUrl imageUrl videoUrl measurement ratio lab',
        populate: {
          path: 'shape',
          select: 'code label'
        }
      })
      .lean();
    
    // Clean up - ensure only selected values are returned
    if (updatedCart.items) {
      updatedCart.items = updatedCart.items.map(item => {
        if (item.itemType === 'dyo' && item.product) {
          // Only return minimal product info, not full product with all options
          item.product = {
            _id: item.product._id,
            productSku: item.product.productSku,
            productName: item.product.productName || item.product.title,
            default_price: item.product.default_price
          };
        }
        return item;
      });
    }
    
    res.json({
      success: true,
      message: newQty <= 0 ? 'Item removed from cart' : 'Cart updated',
      cart: updatedCart
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Remove item from cart
 * DELETE /api/cart/items/:itemId
 */
exports.removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid item ID' 
      });
    }
    
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ 
        success: false,
        message: 'Cart not found' 
      });
    }
    
    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: 'Item not found in cart' 
      });
    }
    
    cart.items.pull(itemId);
    await cart.save();
    
    // Populate and return - only selected fields
    const updatedCart = await Cart.findById(cart._id)
      .populate('items.variant', 'variant_sku productSku metal_type shape carat price')
      .populate('items.product', 'productSku productName title default_price description main_shape style')
      .populate({
        path: 'items.selectedDiamond',
        select: 'sku shape carat cut color purity polish symmetry fluorescence price pricePerCarat certNumber certUrl imageUrl videoUrl measurement ratio lab',
        populate: {
          path: 'shape',
          select: 'code label'
        }
      })
      .lean();
    
    // Clean up - ensure only selected values are returned
    if (updatedCart.items) {
      updatedCart.items = updatedCart.items.map(item => {
        if (item.itemType === 'dyo' && item.product) {
          // Only return minimal product info, not full product with all options
          item.product = {
            _id: item.product._id,
            productSku: item.product.productSku,
            productName: item.product.productName || item.product.title,
            default_price: item.product.default_price
          };
        }
        return item;
      });
    }
    
    res.json({
      success: true,
      message: 'Item removed from cart',
      cart: updatedCart
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Clear entire cart
 * DELETE /api/cart
 */
exports.clearCart = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    } else {
      cart.items = [];
      await cart.save();
    }
    
    res.json({
      success: true,
      message: 'Cart cleared',
      cart
    });
    
  } catch (err) {
    next(err);
  }
};
