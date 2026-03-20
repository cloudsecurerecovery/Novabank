import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../supabaseClient';
import { User, Mail, Phone, Camera, CheckCircle2, AlertCircle, Save, Lock, Shield, Trash2, FileText, Upload, Download, Loader2, XCircle } from 'lucide-react';
import { storageService } from '../services/storageService';
import { AvatarImage } from '../components/AvatarImage';
import { validatePhone, validatePassword } from '../utils/validation';

interface UserDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  created_at: string;
}

export default function Profile() {
  const { user, updateUser } = useAuthStore();
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    phone: user?.phone || '',
  });
  const [profileImage, setProfileImage] = useState(user?.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Documents state
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.full_name || '',
        phone: user.phone || '',
      });
      setProfileImage(user.avatar_url || '');
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    if (!user) return;
    setDocsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setDocUploading(true);
      setError('');
      
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      if (!user) return;

      // Upload to storage
      const filePath = await storageService.uploadFile(
        user.id,
        'documents',
        `${Date.now()}_${file.name}`,
        file
      );

      // Save to database
      const { error: dbError } = await supabase
        .from('user_documents')
        .insert([{
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type
        }]);

      if (dbError) throw dbError;

      await fetchDocuments();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error uploading document');
    } finally {
      setDocUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: UserDocument) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      setDocsLoading(true);
      // Delete from storage
      await storageService.deleteFile(doc.file_path);

      // Delete from database
      const { error } = await supabase
        .from('user_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;
      await fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Error deleting document');
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDownloadDocument = async (filePath: string) => {
    try {
      const url = await storageService.getSignedUrl(filePath);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error downloading document:', err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError('');
      
      if (!e.target.files || e.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = e.target.files[0];
      
      if (!user) return;

      // Upload using storage service
      const filePath = await storageService.uploadFile(
        user.id,
        'profile',
        user.id,
        file
      );

      setProfileImage(filePath);
      
      // Update profile immediately with new image path
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: filePath })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      updateUser({ avatar_url: filePath });
      
      // Log to audit log
      const { auditService } = await import('../services/auditService');
      await auditService.log(user.id, 'avatar_update', {
        file_path: filePath
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
    } catch (error: any) {
      setError(error.message || 'Error uploading image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user || !user.avatar_url) return;

    try {
      setUploading(true);
      setError('');

      // Delete from storage
      await storageService.deleteFile(user.avatar_url);

      // Update database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update local state
      setProfileImage('');
      updateUser({ avatar_url: undefined });
      
      // Log to audit log
      const { auditService } = await import('../services/auditService');
      await auditService.log(user.id, 'avatar_remove', {
        old_path: user.avatar_url
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      setError(error.message || 'Error removing image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (formData.phone && !validatePhone(formData.phone)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.name,
          phone: formData.phone,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      updateUser({
        full_name: formData.name,
        phone: formData.phone,
      });
      
      // Log to audit log
      const { auditService } = await import('../services/auditService');
      await auditService.log(user.id, 'profile_update', {
        name: formData.name,
        phone: formData.phone
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setPasswordError(validation.message);
      return;
    }

    setPasswordLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Notify on password change
      const { notificationService } = await import('../services/notificationService');
      await notificationService.notify(user.id, 'password_change', 'Your password was successfully updated.');

      // Log to audit log
      const { auditService } = await import('../services/auditService');
      await auditService.log(user.id, 'password_change', {
        timestamp: new Date().toISOString()
      });

      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your personal information and preferences.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#007856] px-6 py-4">
          <h2 className="text-lg font-medium text-white">Personal Information</h2>
        </div>
        
        <div className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-600 p-4 rounded-r-md flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-600 p-4 rounded-r-md flex items-start">
              <CheckCircle2 className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-green-800">Profile updated successfully.</p>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-8">
            {/* Profile Picture */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative h-32 w-32 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-md group">
                <AvatarImage 
                  avatarUrl={profileImage} 
                  fullName={user?.full_name} 
                  className="h-full w-full object-cover"
                />
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-8 w-8 text-white" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    disabled={uploading}
                  />
                </label>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-900">Profile Photo</p>
                <div className="flex flex-col gap-2 mt-1">
                  <p className="text-xs text-slate-500">
                    {uploading ? 'Processing...' : 'Click image to change'}
                  </p>
                  {profileImage && !uploading && (
                    <button
                      onClick={handleRemoveImage}
                      className="text-xs text-red-600 hover:text-red-800 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="flex-1">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700">Full Name</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email Address</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        disabled
                        value={user?.email || ''}
                        className="bg-slate-50 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Email cannot be changed.</p>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Phone Number</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#007856] hover:bg-[#006045] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#007856] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                    {!loading && <Save className="ml-2 h-4 w-4" />}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#FFB612]" />
            <h2 className="text-lg font-medium text-white">Documents & Verification</h2>
          </div>
          <label className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md text-slate-800 bg-[#FFB612] hover:bg-[#e5a410] transition-colors">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload Document
            <input type="file" className="hidden" onChange={handleDocumentUpload} disabled={docUploading} />
          </label>
        </div>
        
        <div className="p-6">
          {docUploading && (
            <div className="flex items-center justify-center py-4 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm font-medium">Uploading document...</span>
            </div>
          )}

          {!docUploading && documents.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">No documents uploaded yet.</p>
              <p className="text-xs text-slate-400 mt-1">Upload ID or proof of address for verification.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center border border-slate-200 flex-shrink-0">
                      <FileText className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-slate-900 truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleDownloadDocument(doc.file_path)}
                      className="p-2 text-slate-400 hover:text-[#007856] transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteDocument(doc)}
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 px-6 py-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#FFB612]" />
          <h2 className="text-lg font-medium text-white">Security & Password</h2>
        </div>
        
        <div className="p-6">
          {passwordError && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-600 p-4 rounded-r-md flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{passwordError}</p>
            </div>
          )}
          
          {passwordSuccess && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-600 p-4 rounded-r-md flex items-start">
              <CheckCircle2 className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-green-800">Password updated successfully.</p>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">New Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  id="newPassword"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">Confirm New Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  id="confirmPassword"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={passwordLoading || !newPassword}
                className="inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordLoading ? 'Updating...' : 'Update Password'}
                {!passwordLoading && <Save className="ml-2 h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
