import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { firebase, db, Timestamp } from "../firebase";
import type { Client } from "../types";
import PlusIcon from "../components/icons/PlusIcon";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";
import DotsVerticalIcon from "../components/icons/DotsVerticalIcon";
import PencilIcon from "../components/icons/PencilIcon";
import TrashIcon from "../components/icons/TrashIcon";
import { useAuth } from "../contexts/AuthContext";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "インスタントウィン管理画面｜クライアント一覧";
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchClients = async (user: firebase.User) => {
      try {
        const querySnapshot = await db
          .collection("clients")
          .where("ownerId", "==", user.uid)
          .get();
        const clientsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            createdAt: (
              data.createdAt as InstanceType<typeof Timestamp>
            )?.toDate(),
          };
        }) as Client[];
        clientsData.sort(
          (a, b) =>
            (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
        );
        setClients(clientsData);
      } catch (error) {
        console.error("Error fetching clients: ", error);
        showToast("クライアントの読み込みに失敗しました", "error");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchClients(user);
    }
  }, [showToast, user]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newClientName.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        if (!user) throw new Error("User not authenticated");

        const now = new Date();
        const docRef = await db.collection("clients").add({
          ownerId: user.uid,
          name: newClientName.trim(),
          createdAt: now,
        });
        const newClient: Client = {
          id: docRef.id,
          name: newClientName.trim(),
          createdAt: now,
        };
        setClients((prevClients) =>
          [newClient, ...prevClients].sort(
            (a, b) =>
              (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
          ),
        );
        setNewClientName("");
        setShowAddForm(false);
        showToast("クライアントを追加しました", "success");
      } catch (error) {
        console.error("Error adding client: ", error);
        showToast("クライアントの追加に失敗しました", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editingClient.name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await db
        .collection("clients")
        .doc(editingClient.id)
        .update({ name: editingClient.name });
      setClients((prev) =>
        prev.map((c) => (c.id === editingClient.id ? editingClient : c)),
      );
      showToast("クライアント名を更新しました", "success");
      setEditingClient(null);
    } catch (error) {
      console.error("Error updating client:", error);
      showToast("クライアント名の更新に失敗しました", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!deletingClient || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const campaignsQuery = db
        .collection("campaigns")
        .where("clientId", "==", deletingClient.id);
      const campaignsSnapshot = await campaignsQuery.get();

      const batch = db.batch();

      // This is simplified. A robust solution for large data might need a Cloud Function.
      for (const campaignDoc of campaignsSnapshot.docs) {
        const campaignId = campaignDoc.id;
        // Delete related data (participants, inquiries, etc.)
        const participantsQuery = db
          .collection("participants")
          .where("campaignId", "==", campaignId);
        const participantsSnapshot = await participantsQuery.get();
        participantsSnapshot.forEach((doc) => batch.delete(doc.ref));

        const inquiriesQuery = db
          .collection("inquiries")
          .where("campaignId", "==", campaignId);
        const inquiriesSnapshot = await inquiriesQuery.get();
        inquiriesSnapshot.forEach((doc) => batch.delete(doc.ref));

        const requestsQuery = db
          .collection("participationRequests")
          .where("campaignId", "==", campaignId);
        const requestsSnapshot = await requestsQuery.get();
        requestsSnapshot.forEach((doc) => batch.delete(doc.ref));

        // Delete campaign itself
        batch.delete(campaignDoc.ref);
      }

      // Delete client
      batch.delete(db.collection("clients").doc(deletingClient.id));

      await batch.commit();

      setClients((prev) => prev.filter((c) => c.id !== deletingClient.id));
      showToast("クライアントと関連データをすべて削除しました", "success");
      setDeletingClient(null);
      setConfirmDeleteName("");
    } catch (error) {
      console.error("Error deleting client:", error);
      showToast("クライアントの削除に失敗しました", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">クライアント名を編集</h2>
            <form onSubmit={handleUpdateClient}>
              <input
                type="text"
                value={editingClient.name}
                onChange={(e) =>
                  setEditingClient({ ...editingClient, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md mb-4"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 bg-slate-200 rounded-md"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-800 text-white rounded-md disabled:bg-slate-400 flex items-center"
                >
                  {isSubmitting && <Spinner size="sm" className="mr-2" />}
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Client Modal */}
      {deletingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-lg font-bold text-red-600 mb-2">
              クライアントを削除
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              「<span className="font-bold">{deletingClient.name}</span>
              」を削除すると、関連するすべてのキャンペーンと参加者データも完全に削除されます。この操作は元に戻せません。
            </p>
            <p className="text-sm text-slate-600 mb-4">
              削除を確定するには、クライアント名を入力してください。
            </p>
            <input
              type="text"
              value={confirmDeleteName}
              onChange={(e) => setConfirmDeleteName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
                className="px-4 py-2 bg-slate-200 rounded-md"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={
                  isSubmitting || confirmDeleteName !== deletingClient.name
                }
                className="px-4 py-2 bg-red-600 text-white rounded-md disabled:bg-red-300 flex items-center"
              >
                {isSubmitting && <Spinner size="sm" className="mr-2" />}
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">クライアント一覧</h1>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            <PlusIcon />
            新規クライアント作成
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddClient}
          className="mb-8 p-4 bg-white rounded-lg shadow"
        >
          <h2 className="text-lg font-semibold mb-3">新規クライアント</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="クライアント名"
              className="flex-grow w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500"
              required
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors disabled:bg-slate-400 flex items-center"
                disabled={isSubmitting}
              >
                {isSubmitting && <Spinner size="sm" className="mr-2" />}
                追加
              </button>
            </div>
          </div>
        </form>
      )}

      {clients.length === 0 && !showAddForm ? (
        <div className="text-center py-12 px-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium text-slate-700">
            クライアントがありません
          </h3>
          <p className="text-slate-500 mt-2">
            最初のクライアントを作成しましょう。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div
              key={client.id}
              className="group bg-white p-6 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <Link to={`clients/${client.id}`} className="block flex-grow">
                  <h2 className="text-lg font-semibold text-slate-800 group-hover:text-slate-900 transition-colors">
                    {client.name}
                  </h2>
                </Link>
                <div
                  ref={activeDropdown === client.id ? dropdownRef : null}
                  className="relative flex-shrink-0"
                >
                  <button
                    onClick={() =>
                      setActiveDropdown(
                        activeDropdown === client.id ? null : client.id,
                      )
                    }
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                  >
                    <DotsVerticalIcon className="w-5 h-5" />
                  </button>
                  {activeDropdown === client.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-slate-200">
                      <button
                        onClick={() => {
                          setEditingClient(client);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <PencilIcon className="w-4 h-4" />
                        名前を編集
                      </button>
                      <button
                        onClick={() => {
                          setDeletingClient(client);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon className="w-4 h-4" />
                        削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
