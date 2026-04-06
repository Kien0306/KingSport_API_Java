let userModel = require('../schemas/users');

function baseUserQuery() {
  return userModel.find({ isDeleted: false }).populate('role', 'name description');
}

module.exports = {
  sanitizeUser: function (user) {
    if (!user) return null;
    let obj = user.toObject ? user.toObject() : { ...user };
    delete obj.password;
    delete obj.forgotPasswordToken;
    delete obj.forgotPasswordTokenExp;
    return obj;
  },
  CreateAnUser: async function (username, password, email, role, forgotPasswordToken, fullName, avatarUrl, status = true, loginCount = 0, session = null) {
    let newItem = new userModel({
      username,
      password,
      email,
      fullName,
      avatarUrl,
      status,
      role,
      loginCount,
      forgotPasswordToken
    });
    await newItem.save(session ? { session } : undefined);
    return newItem;
  },
  GetAllUser: async function () {
    return await baseUserQuery();
  },
  GetAnUserByUsername: async function (username) {
    return await userModel.findOne({ isDeleted: false, username }).populate('role');
  },
  GetAnUserByEmail: async function (email) {
    return await userModel.findOne({ isDeleted: false, email }).populate('role');
  },
  GetAnUserByToken: async function (token) {
    let user = await userModel.findOne({ isDeleted: false, forgotPasswordToken: token }).populate('role');
    if (user && user.forgotPasswordTokenExp > Date.now()) {
      return user;
    }
    return false;
  },
  GetAnUserById: async function (id) {
    return await userModel.findOne({ isDeleted: false, _id: id }).populate('role');
  }
};
