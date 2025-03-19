const { db, admin } = require('../../config/firebase');
const { auth } = require('../../config/firebase'); 
const changeUid = async (oldUid, newUid) => {
    try {
        // Lấy dữ liệu người dùng cũ
        const oldUserRef = db.collection('users').doc(oldUid);
        const oldUserDoc = await oldUserRef.get();
        if (!oldUserDoc.exists) {
            console.error('User not found');
            return;
        }
        const userData = oldUserDoc.data();

        // Tạo tài liệu người dùng mới với UID mới
        const newUserRef = db.collection('users').doc(newUid);
        await newUserRef.set(userData);

        // Xóa tài liệu người dùng cũ
        await oldUserRef.delete();

        console.log('UID changed successfully');
    } catch (error) {
        console.error('Error changing UID:', error);
    }
};
const getCurrentUser = async (uid) => {
    try {
        const userRecord = await admin.auth().getUser(uid);
        console.log('Successfully fetched user data:', userRecord.toJSON());
        return userRecord;
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
};
// Thay đổi các giá trị oldUid và newUid theo nhu cầu của bạn
const oldUid = 'central-cloud-for-aiot';
const newUid = 'cloud-aiot';

// changeUid(oldUid, newUid);
// getCurrentUser(newUid);
console.log(auth.getCurrentUser);