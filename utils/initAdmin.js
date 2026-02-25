const User = require('../models/User');

module.exports = async function initAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      const admin = new User({
        name: 'Administrator',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        isActive: true
      });
      await admin.save();
      console.log('✅ Admin account created:', adminEmail);
    } else if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log('✅ Existing user promoted to admin:', adminEmail);
    } else {
      console.log('✅ Admin account verified:', adminEmail);
    }
  } catch (err) {
    console.error('❌ Admin init error:', err.message);
  }
};
