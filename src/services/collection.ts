import type { Species } from '../types';
import { supabase } from '../lib/supabase';

/* 图鉴收集 service
 * - 已登录 + Supabase 已配置：读写云端表 collections（多端同步）
 * - 未登录 / 未配置：读写 localStorage（本地模式）
 * - 登录时：把本地已收集的合并上云（migrateLocalToCloud）
 */

const LOCAL_KEY = 'nature_explorer_collection_v1';

/* ---------- 本地存储 ---------- */
function localGetAll(): Species[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function localSave(list: Species[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

/* ---------- 云端表结构映射 ---------- */
function toRow(species: Species, userId: string) {
  return {
    user_id: userId,
    species_id: species.id,
    taxon_id: species.taxonId ?? null,
    cn_name: species.cn_name,
    sci_name: species.sci_name,
    taxon: species.taxon,
    photo: species.photo ?? null,
    wiki: species.wiki ?? null,
    location: species.location ?? null,
  };
}
function fromRow(row: any): Species {
  return {
    id: row.species_id,
    taxonId: row.taxon_id,
    cn_name: row.cn_name,
    sci_name: row.sci_name,
    taxon: row.taxon,
    photo: row.photo,
    wiki: row.wiki,
    location: row.location,
    collectedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

/* ---------- 对外 API ---------- */
export const CollectionService = {
  /** 获取全部已收集物种 */
  async getAll(userId: string | null): Promise<Species[]> {
    if (supabase && userId) {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[Collection] 云端读取失败，降级本地:', error.message);
        return localGetAll();
      }
      return (data || []).map(fromRow);
    }
    return localGetAll();
  },

  /** 收集一个物种。返回 true=新增成功，false=已存在 */
  async add(species: Species, userId: string | null): Promise<boolean> {
    if (supabase && userId) {
      const { error } = await supabase.from('collections').insert(toRow(species, userId));
      if (error) {
        // 23505 = 唯一约束冲突（已收集）
        if (error.code === '23505') return false;
        console.warn('[Collection] 云端写入失败，降级本地:', error.message);
        return addLocal(species);
      }
      return true;
    }
    return addLocal(species);
  },

  /** 移除一个物种 */
  async remove(speciesId: string, userId: string | null): Promise<void> {
    if (supabase && userId) {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('user_id', userId)
        .eq('species_id', speciesId);
      if (error) console.warn('[Collection] 云端删除失败:', error.message);
      return;
    }
    localSave(localGetAll().filter((s) => s.id !== speciesId));
  },

  /** 登录后：把本地收集合并到云端（避免登录前的收藏丢失） */
  async migrateLocalToCloud(userId: string): Promise<number> {
    if (!supabase) return 0;
    const local = localGetAll();
    if (local.length === 0) return 0;
    const cloud = await this.getAll(userId);
    const cloudIds = new Set(cloud.map((s) => s.id));
    const toUpload = local.filter((s) => !cloudIds.has(s.id));
    if (toUpload.length > 0) {
      const rows = toUpload.map((s) => toRow(s, userId));
      const { error } = await supabase.from('collections').upsert(rows, {
        onConflict: 'user_id,species_id',
        ignoreDuplicates: true,
      });
      if (error) {
        console.warn('[Collection] 合并上云失败:', error.message);
        return 0;
      }
    }
    // 合并成功后清空本地，避免重复
    localSave([]);
    return toUpload.length;
  },
};

function addLocal(species: Species): boolean {
  const all = localGetAll();
  if (all.some((s) => s.id === species.id)) return false;
  all.push({ ...species, collectedAt: Date.now() });
  localSave(all);
  return true;
}
