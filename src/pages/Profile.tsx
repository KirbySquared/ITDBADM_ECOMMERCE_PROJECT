import './Profile.css'

function Profile() {
  return (
    <div className="profile">
      <div className="container">
        <h1>User Profile</h1>
        
        <div className="profile-content">
          <div className="profile-info">
            <h2>Account Information</h2>
            <div className="info-item">
              <label>Name:</label>
              <span>John Doe</span>
            </div>
            <div className="info-item">
              <label>Email:</label>
              <span>john.doe@example.com</span>
            </div>
            <div className="info-item">
              <label>Member Since:</label>
              <span>January 2024</span>
            </div>
          </div>
          
          <div className="profile-actions">
            <h2>Account Actions</h2>
            <button className="btn btn-outline">Edit Profile</button>
            <button className="btn btn-outline">Change Password</button>
            <button className="btn btn-outline">Order History</button>
            <button className="btn btn-danger">Delete Account</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
