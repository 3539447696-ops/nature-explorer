import { useRef, useState } from 'react';
import { Modal, Button, Input } from 'animal-island-ui';
import type { Post, Species } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { CommunityService } from '../services/community';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 预关联的物种（从物种详情点“分享”时带入），可空 */
  presetSpecies?: Species | null;
  /** 当前地点名 */
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  onPosted: (post: Post) => void;
}

/** 发布分享面板：选图 → 写描述 → 发布。可关联物种与地点。 */
export function SharePanel({ open, onClose, presetSpecies, location, lat, lng, onPosted }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [locInput, setLocInput] = useState(location || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pickFile = (f: File | null) => {
    setError('');
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('图片太大了（请小于 5MB）');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setCaption('');
    setError('');
    setSubmitting(false);
  };

  const submit = async () => {
    setError('');
    if (!user) {
      setError('请先登录再分享');
      return;
    }
    if (!file) {
      setError('请先选择一张照片');
      return;
    }
    setSubmitting(true);
    try {
      const photoUrl = await CommunityService.uploadPhoto(file, user.id);
      const post = await CommunityService.createPost({
        userId: user.id,
        userEmail: user.email,
        photoUrl,
        caption: caption.trim(),
        location: locInput.trim() || location || null,
        lat: lat ?? null,
        lng: lng ?? null,
        species: presetSpecies ?? null,
      });
      if (post) {
        onPosted(post);
        reset();
        onClose();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} typewriter={false} footer={null} width={440} title="📸 分享我的发现">
      {!CommunityService.available() ? (
        <p style={{ color: 'var(--animal-text-muted)', lineHeight: 1.7 }}>
          社区功能需要配置云端（Supabase）后才能使用。
        </p>
      ) : (
        <div className="share-panel">
          {presetSpecies && (
            <div className="share-species-tag">
              关联物种：<strong>{presetSpecies.cn_name}</strong>
            </div>
          )}

          {/* 选图区 */}
          <div
            className="share-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="预览" />
            ) : (
              <div className="share-dropzone-empty">
                <div className="share-dropzone-icon">📷</div>
                <div>点击选择照片</div>
                <small>你拍到的植物 / 鸟类 / 昆虫…</small>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="share-field">
            <label>描述（这是什么？在哪拍的？有什么故事？）</label>
            <Input
              value={caption}
              placeholder="例如：清晨在公园湖边遇到的它，正在梳理羽毛～"
              onChange={(e) => setCaption((e.target as HTMLInputElement).value)}
            />
          </div>

          <div className="share-field">
            <label>拍摄地点</label>
            <Input
              value={locInput}
              placeholder="例如：北京 · 颐和园"
              onChange={(e) => setLocInput((e.target as HTMLInputElement).value)}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button type="primary" block size="large" loading={submitting} onClick={submit}>
              发布分享
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
