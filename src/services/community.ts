import { supabase } from '../lib/supabase';
import type { Post, Species } from '../types';

/* 社区分享 service
 * 依赖 Supabase：posts 表 + post-photos 存储桶。
 * 未配置 Supabase 时，社区功能不可用（返回空/提示）。
 */

const BUCKET = 'post-photos';

function fromRow(row: any): Post {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    speciesId: row.species_id,
    speciesCn: row.species_cn,
    speciesSci: row.species_sci,
    taxon: row.taxon,
    photoUrl: row.photo_url,
    caption: row.caption,
    location: row.location,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export const CommunityService = {
  /** 社区是否可用（需配置 Supabase） */
  available(): boolean {
    return !!supabase;
  },

  /** 上传照片到 Storage，返回公开 URL */
  async uploadPhoto(file: File, userId: string): Promise<string> {
    if (!supabase) throw new Error('云端未配置');
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw new Error('图片上传失败：' + error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  /** 发布一条分享 */
  async createPost(params: {
    userId: string;
    userEmail?: string | null;
    photoUrl: string;
    caption?: string;
    location?: string | null;
    lat?: number | null;
    lng?: number | null;
    species?: Species | null;
  }): Promise<Post | null> {
    if (!supabase) throw new Error('云端未配置');
    const row = {
      user_id: params.userId,
      user_email: params.userEmail ?? null,
      species_id: params.species?.id ?? null,
      species_cn: params.species?.cn_name ?? null,
      species_sci: params.species?.sci_name ?? null,
      taxon: params.species?.taxon ?? null,
      photo_url: params.photoUrl,
      caption: params.caption ?? null,
      location: params.location ?? null,
      lat: params.lat ?? null,
      lng: params.lng ?? null,
    };
    const { data, error } = await supabase.from('posts').insert(row).select().single();
    if (error) throw new Error('发布失败：' + error.message);
    return data ? fromRow(data) : null;
  },

  /** 获取所有分享（社区时间流） */
  async getFeed(limit = 50): Promise<Post[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('[Community] 拉取社区失败:', error.message);
      return [];
    }
    return (data || []).map(fromRow);
  },

  /** 获取某个物种的分享（物种卡片内嵌用） */
  async getBySpecies(speciesId: string, limit = 20): Promise<Post[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('species_id', speciesId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('[Community] 拉取物种分享失败:', error.message);
      return [];
    }
    return (data || []).map(fromRow);
  },

  /** 删除自己的分享 */
  async deletePost(postId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) console.warn('[Community] 删除失败:', error.message);
  },
};
