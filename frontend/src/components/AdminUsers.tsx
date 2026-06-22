import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Search, 
  Filter,
  User as UserIcon,
  ShieldCheck,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { API_URL } from '../config';

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  provider: string;
  profile_picture?: string;
  created_at: string;
}

export function AdminUsers() {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (roleFilter) params.append('role', roleFilter);
        if (providerFilter) params.append('provider', providerFilter);
        
        const response = await fetch(`${API_URL}/api/admin/users?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to retrieve user directory');
        }
        const data = await response.json();
        setUsers(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading user directory');
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchUsers();
    }
  }, [token, searchTerm, roleFilter, providerFilter]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* Title Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider uppercase mb-2">
          Identity Management
        </div>
        <h2 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
          User Directory
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 font-normal">
          Search, filter, and inspect registered operator accounts.
        </p>
      </div>

      {/* Query Filter row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-900/10 border border-white/5 rounded-2xl">
        
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-all font-mono"
          />
        </div>

        {/* Role filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-slate-950/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-350 focus:outline-none focus:border-purple-500/50 transition-all appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-slate-200">All Roles</option>
            <option value="user" className="bg-slate-900 text-slate-200">User Role</option>
            <option value="admin" className="bg-slate-900 text-slate-200">Admin Role</option>
          </select>
        </div>

        {/* Provider filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="w-full bg-slate-950/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-350 focus:outline-none focus:border-purple-500/50 transition-all appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-slate-200">All Providers</option>
            <option value="local" className="bg-slate-900 text-slate-200">Local Email</option>
            <option value="google" className="bg-slate-900 text-slate-200">Google OAuth</option>
          </select>
        </div>

      </div>

      {/* Users table */}
      <div className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4">
            <div className="h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-xs font-mono">Filtering users...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-450 flex items-center justify-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <span className="text-xs font-mono">{error}</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-xs font-semibold font-mono">
            No registered users found matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-slate-400 border-b border-white/5 uppercase font-mono text-[9px] tracking-wider">
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Login Provider</th>
                  <th className="px-6 py-3">Created At</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {users.map((user) => (
                  <tr 
                    key={user.id} 
                    className="hover:bg-white/[0.01] transition-all cursor-pointer group"
                    onClick={() => navigate(`/admin/user/${user.id}`)}
                  >
                    <td className="px-6 py-3.5 flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-slate-950 border border-white/10 flex items-center justify-center overflow-hidden">
                        {user.profile_picture ? (
                          <img src={user.profile_picture} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>
                      <span className="font-bold text-slate-200">{user.name}</span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-400 text-[11px]">{user.email}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase inline-flex items-center gap-1 ${
                        user.role === 'admin' 
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/15' 
                          : 'bg-slate-500/10 text-slate-400 border border-white/5'
                      }`}>
                        {user.role === 'admin' && <ShieldCheck className="h-2.5 w-2.5" />}
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 capitalize">
                      {user.provider}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button className="text-slate-400 group-hover:text-purple-400 transition-colors p-1 rounded hover:bg-white/5">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
