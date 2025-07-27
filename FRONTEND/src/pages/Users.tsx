import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  User,
  Shield,
  Calendar,
  ArrowLeft,
  MoreVertical,
  X,
  User2,
  
  RefreshCcw,
} from "lucide-react";
import { useUserStore } from "../store/userStore";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Pagination from "../components/features/Pagination";
import { formatDateShort } from "../utils/helpers";

const Users: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const {
    users,
    loading,
    error,
    pagination,
    getUsers,
    deleteUser,
    restoreUser,
    clearError,
  } = useUserStore();

  // Ensure pagination has default values
  const safePagination = pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  };
  const { addNotification } = useUIStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeUserMenu, setActiveUserMenu] = useState<number | null>(null);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  // Check if current user is admin
  if (currentUser?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso denegado
          </h3>
          <p className="text-gray-600 mb-6">
            No tienes permisos para acceder a esta sección
          </p>
          <Button
            variant="primary"
            onClick={() => navigate("/")}
            className="w-full"
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    getUsers(safePagination.page);
  };

  const handlePageChange = (page: number) => {
    getUsers(page, safePagination.limit);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Implement search functionality if needed
  };

  const handleCreateUser = () => {
    navigate("/users/new");
  };

  const handleRestoreUser = async(userId: number) =>{
    try {
      await restoreUser(userId);
      addNotification({
        type: "success",
        title: "Usuario restaurado",
        message: "El usuario se ha restaurado correctamente",
      });
    } catch (error: unknown) {
      console.log(error);
      // Error is handled by the store
    } finally {
      handleRefresh()
    }
    setActiveUserMenu(null);
  }

  const handleEditUser = (userId: number) => {
    navigate(`/users/${userId}/edit`);
    setActiveUserMenu(null);
  };

  const handleDeleteUser = async (userId: number) => {
    if (userId === currentUser?.id) {
      addNotification({
        type: "error",
        title: "Error",
        message: "No puedes eliminar tu propia cuenta",
      });
      return;
    }

    try {
      await deleteUser(userId);
      addNotification({
        type: "success",
        title: "Usuario eliminado",
        message: "El usuario se ha eliminado correctamente",
      });
    } catch (error: unknown) {
      console.log(error);
      // Error is handled by the store
    } finally {
      handleRefresh()
    }
    setActiveUserMenu(null);
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <Shield className="w-3 h-3 mr-1" />
          Admin
        </span>
      );
    }

    if (role === "seller") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <User2 className="w-3 h-3 mr-1" />
          Vendedor
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <User className="w-3 h-3 mr-1" />
        Comprador
      </span>
    );
  };

  const filteredUsers = (users || []).filter(
    (user) =>
      user &&
      user.username &&
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !user.deletedAt
  );

  const usersDeleted = (users || []).filter((user) => user.deletedAt);

  if (loading && (!users || users.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <ErrorMessage
          message={error}
          onDismiss={clearError}
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-7xl mx-auto">
      {/* Mobile Header */}
      <div className="sticky top-0 z-30 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Usuarios</h1>
              <p className="text-sm text-gray-500">
                {filteredUsers.length} usuarios
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {isSearchOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={handleCreateUser}
              size="sm"
              className="px-3"
            >
              Nuevo
            </Button>
          </div>
        </div>
      </div>

      {/* Search Bar - Collapsible */}
      {isSearchOpen && (
        <div className="sticky top-16 z-20 border-b border-gray-200 px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar usuarios..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="px-4 py-4 space-y-2">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200"
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-base font-medium text-gray-900 truncate">
                        {user.username}
                      </h3>
                      {user.id === currentUser?.id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Tú
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getRoleBadge(user.role)}
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>{formatDateShort(user.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Menu */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setActiveUserMenu(
                        activeUserMenu === user.id ? null : user.id
                      )
                    }
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {activeUserMenu === user.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setActiveUserMenu(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        <button
                          onClick={() => handleEditUser(user.id)}
                          className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Edit className="w-4 h-4 text-gray-400" />
                          <span>Editar usuario</span>
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Eliminar usuario</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {usersDeleted.length > 0 && (
        <h3 className="py-2 px-2 font-bold">Usuarios eliminados</h3>

        )}
        {usersDeleted.map((user) => (
          <div
            key={user.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200"
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-base font-medium text-gray-900 truncate">
                        {user.username}
                      </h3>
                      {user.id === currentUser?.id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Tú
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getRoleBadge(user.role)}
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <Trash2 className="w-3 h-3 mr-1" />
                        <span>{formatDateShort(user.deletedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Menu */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setActiveUserMenu(
                        activeUserMenu === user.id ? null : user.id
                      )
                    }
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {activeUserMenu === user.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setActiveUserMenu(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        <button
                          onClick={() => handleRestoreUser(user.id)}
                          className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <RefreshCcw className="w-4 h-4 text-gray-400" />
                          <span>Restaurar</span>
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Eliminar usuario</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredUsers.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay usuarios
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? "No se encontraron usuarios con esa búsqueda"
                : "Aún no hay usuarios registrados"}
            </p>
            {!searchQuery && (
              <Button variant="primary" icon={Plus} onClick={handleCreateUser}>
                Crear primer usuario
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {safePagination.totalPages > 1 && (
        <div className="px-4 py-6">
          <Pagination
            pagination={safePagination}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Bottom safe area for mobile */}
      <div className="h-6" />
    </div>
  );
};

export default Users;
