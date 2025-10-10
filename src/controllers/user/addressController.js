const Address = require('../../models/user/Address');
const User = require('../../models/user/User');

exports.addAddress = async (req, res, next) => {
  try {
    const data = req.body;
    const userId = req.user._id;
    const address = new Address(data);
    await address.save();

    // push into user's addresses and handle default
    const update = { $addToSet: { addresses: address._id } };
    if (data.isDefault) update.$set = { defaultAddressId: address._id };
    await User.findByIdAndUpdate(userId, update, { new: true });

    res.status(201).json(address);
  } catch (err) { next(err); }
};

exports.listAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('addresses');
    res.json({ addresses: user?.addresses || [], defaultAddressId: user?.defaultAddressId || null });
  } catch (err) { next(err); }
};

exports.updateAddress = async (req, res, next) => {
  try {
    const id = req.params.id;
    // ensure this address belongs to the user
    const user = await User.findOne({ _id: req.user._id, addresses: id }).select('_id defaultAddressId');
    if (!user) return res.status(404).json({ message: 'Not found' });

    const data = { ...req.body };
    const updated = await Address.findByIdAndUpdate(id, data, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });

    if (data.isDefault) {
      await User.findByIdAndUpdate(req.user._id, { defaultAddressId: id });
    }

    res.json(updated);
  } catch (err) { next(err); }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    const id = req.params.id;
    // ensure this address belongs to the user
    const user = await User.findOne({ _id: req.user._id, addresses: id }).select('_id defaultAddressId');
    if (!user) return res.status(404).json({ message: 'Not found' });

    await Address.findByIdAndDelete(id);
    const update = { $pull: { addresses: id } };
    if (String(user.defaultAddressId || '') === String(id)) update.$unset = { defaultAddressId: '' };
    await User.findByIdAndUpdate(req.user._id, update);

    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

