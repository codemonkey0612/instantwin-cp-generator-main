import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db, Timestamp } from "../firebase";
import type { Client, Campaign, CampaignStatus } from "../types";
import PlusIcon from "../components/icons/PlusIcon";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";
import DotsVerticalIcon from "../components/icons/DotsVerticalIcon";
import PencilIcon from "../components/icons/PencilIcon";
import TrashIcon from "../components/icons/TrashIcon";
import CopyIcon from "../components/icons/CopyIcon";
import { useAuth } from "../contexts/AuthContext";

export const statusBadge = (status: CampaignStatus) => {
  const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
  switch (status) {
    case "draft":
      return (
        <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
          下書き / 一時停止
        </span>
      );
    case "published":
      return (
        <span className={`${baseClasses} bg-green-100 text-green-800`}>
          公開中
        </span>
      );
    case "archived":
      return (
        <span className={`${baseClasses} bg-slate-100 text-slate-800`}>
          アーカイブ済
        </span>
      );
  }
};

const ClientDetails: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(
    null,
  );
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const originalTitleRef = useRef<string | null>(null);

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
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }

    if (client?.name) {
      document.title = `インスタントウィン管理画面｜${client.name}`;
    } else {
      document.title = "インスタントウィン管理画面｜クライアント";
    }
  }, [client?.name]);

  useEffect(() => {
    return () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
    };
  }, []);

  useEffect(() => {
    const fetchClientAndCampaigns = async () => {
      if (!clientId) return;
      setLoading(true);
      try {
        const clientDocRef = db.collection("clients").doc(clientId);
        const clientDocSnap = await clientDocRef.get();

        if (clientDocSnap.exists) {
          const data = clientDocSnap.data();

          if (data) {
            setClient({
              id: clientDocSnap.id,
              name: data.name,
              createdAt: (
                data.createdAt as InstanceType<typeof Timestamp>
              )?.toDate(),
            } as Client);
          }
        } else {
          console.error("No such client!");
          showToast("クライアントが見つかりません", "error");
          setLoading(false);
          return;
        }

        const campaignsQuery = db
          .collection("campaigns")
          .where("clientId", "==", clientId);
        const querySnapshot = await campaignsQuery.get();
        const campaignsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: (
              data.createdAt as InstanceType<typeof Timestamp>
            )?.toDate(),
          };
        }) as Campaign[];
        campaignsData.sort(
          (a, b) =>
            (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
        );
        setCampaigns(campaignsData);
      } catch (error) {
        console.error("Error fetching data: ", error);
        showToast("データの読み込みに失敗しました", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchClientAndCampaigns();
  }, [clientId, showToast]);

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCampaignName.trim() && clientId && !isSubmitting) {
      setIsSubmitting(true);
      try {
        if (!user) {
          showToast(
            "ログイン状態が無効です。再度ログインしてください。",
            "error",
          );
          setIsSubmitting(false);
          return;
        }

        const now = new Date();
        const docRef = await db.collection("campaigns").add({
          ownerId: user.uid,
          clientId,
          name: newCampaignName.trim(),
          status: "draft",
          createdAt: now,
        });

        const newCampaign: Campaign = {
          id: docRef.id,
          clientId,
          name: newCampaignName.trim(),
          status: "draft",
          createdAt: now,
        };

        setCampaigns((prev) =>
          [newCampaign, ...prev].sort(
            (a, b) =>
              (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
          ),
        );
        setNewCampaignName("");
        setShowAddForm(false);
        showToast("キャンペーンを作成しました", "success");
        navigate(`campaigns/${docRef.id}`);
      } catch (error) {
        console.error("Error adding campaign: ", error);
        showToast("キャンペーンの作成に失敗しました", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign || !editingCampaign.name.trim() || isSubmitting)
      return;
    setIsSubmitting(true);
    try {
      await db
        .collection("campaigns")
        .doc(editingCampaign.id)
        .update({ name: editingCampaign.name });
      setCampaigns((prev) =>
        prev.map((c) => (c.id === editingCampaign.id ? editingCampaign : c)),
      );
      showToast("キャンペーン名を更新しました", "success");
      setEditingCampaign(null);
    } catch (error) {
      console.error("Error updating campaign:", error);
      showToast("キャンペーン名の更新に失敗しました", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateCampaign = async (campaignToDuplicate: Campaign) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    showToast("キャンペーンを複製しています...", "info");
    try {
      const newCampaignData: Omit<Campaign, "id"> = {
        ...campaignToDuplicate,
        name: `${campaignToDuplicate.name} (コピー)`,
        status: "draft",
        createdAt: new Date(),
      };

      // Generate new tokens for participation tickets to avoid conflicts
      if (newCampaignData.participationTickets) {
        newCampaignData.participationTickets =
          newCampaignData.participationTickets.map((ticket) => ({
            ...ticket,
            token: crypto.randomUUID(),
          }));
      }
      delete (newCampaignData as any).id; // remove id property
      delete (newCampaignData as any).ticketUsage; // clear usage stats

      const docRef = await db.collection("campaigns").add(newCampaignData);
      const newCampaign: Campaign = {
        id: docRef.id,
        ...newCampaignData,
      };

      setCampaigns((prev) =>
        [newCampaign, ...prev].sort(
          (a, b) =>
            (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
        ),
      );
      showToast("キャンペーンを複製しました", "success");
      navigate(`campaigns/${docRef.id}`);
    } catch (error) {
      console.error("Error duplicating campaign:", error);
      showToast("キャンペーンの複製に失敗しました", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!deletingCampaign || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const campaignId = deletingCampaign.id;
      const batch = db.batch();

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

      batch.delete(db.collection("campaigns").doc(campaignId));

      await batch.commit();

      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      showToast("キャンペーンを削除しました", "success");
      setDeletingCampaign(null);
      setConfirmDeleteName("");
    } catch (error) {
      console.error("Error deleting campaign:", error);
      showToast("キャンペーンの削除に失敗しました", "error");
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

  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-red-600">
          クライアントが見つかりません
        </h2>
        <Link
          to="/admin"
          className="mt-4 inline-block text-slate-800 hover:underline"
        >
          ダッシュボードに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Edit Campaign Modal */}
      {editingCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">キャンペーン名を編集</h2>
            <form onSubmit={handleUpdateCampaign}>
              <input
                type="text"
                value={editingCampaign.name}
                onChange={(e) =>
                  setEditingCampaign({
                    ...editingCampaign,
                    name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md mb-4"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCampaign(null)}
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

      {/* Delete Campaign Modal */}
      {deletingCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-lg font-bold text-red-600 mb-2">
              キャンペーンを削除
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              「<span className="font-bold">{deletingCampaign.name}</span>
              」を削除すると、関連する参加者データも完全に削除されます。この操作は元に戻せません。
            </p>
            <p className="text-sm text-slate-600 mb-4">
              削除を確定するには、キャンペーン名を入力してください。
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
                onClick={() => setDeletingCampaign(null)}
                className="px-4 py-2 bg-slate-200 rounded-md"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteCampaign}
                disabled={
                  isSubmitting || confirmDeleteName !== deletingCampaign.name
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

      <div className="mb-6">
        <Link to="/admin" className="text-sm text-slate-800 hover:underline">
          ダッシュボード
        </Link>
        <span className="mx-2 text-sm text-slate-400">/</span>
        <span className="text-sm text-slate-600">{client.name}</span>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {client.name} のキャンペーン一覧
        </h1>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            <PlusIcon />
            新規キャンペーン作成
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddCampaign}
          className="mb-8 p-4 bg-white rounded-lg shadow"
        >
          <h2 className="text-lg font-semibold mb-3">新規キャンペーン</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              placeholder="キャンペーン名"
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
                作成して編集
              </button>
            </div>
          </div>
        </form>
      )}

      {campaigns.length === 0 && !showAddForm ? (
        <div className="text-center py-12 px-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium text-slate-700">
            キャンペーンがありません
          </h3>
          <p className="text-slate-500 mt-2">
            最初のキャンペーンを作成しましょう。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="group bg-white p-6 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <Link
                  to={`campaigns/${campaign.id}`}
                  className="block flex-grow"
                >
                  <h2 className="text-lg font-semibold text-slate-800 group-hover:text-slate-900 transition-colors">
                    {campaign.name}
                  </h2>
                  <div className="mt-2">{statusBadge(campaign.status)}</div>
                </Link>
                <div
                  ref={activeDropdown === campaign.id ? dropdownRef : null}
                  className="relative flex-shrink-0"
                >
                  <button
                    onClick={() =>
                      setActiveDropdown(
                        activeDropdown === campaign.id ? null : campaign.id,
                      )
                    }
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                  >
                    <DotsVerticalIcon className="w-5 h-5" />
                  </button>
                  {activeDropdown === campaign.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-slate-200">
                      <button
                        onClick={() => {
                          setEditingCampaign(campaign);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <PencilIcon className="w-4 h-4" />
                        名前を編集
                      </button>
                      <button
                        onClick={() => {
                          handleDuplicateCampaign(campaign);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <CopyIcon className="w-4 h-4" />
                        複製
                      </button>
                      <button
                        onClick={() => {
                          setDeletingCampaign(campaign);
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

export default ClientDetails;
