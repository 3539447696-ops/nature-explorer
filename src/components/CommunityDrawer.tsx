import { useEffect, useState } from 'react';
import { Drawer, Button, Tag } from 'animal-island-ui';
import type { Post } from '../types';
import { CommunityService } from '../services/community';
import { getTaxonMeta } from '../constants';

interface Props {
  open: boolean;
  onClose: () => void;
  onShareClick: () => void;
  /** 供外部在发帖后刷新用的信号 */
  refreshKey?: number;
}

/** 社区页（入口1）：时间流展示所有用户的分享。 */
export function CommunityDrawer({ open, onClose, onShareClick, refreshKey }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    CommunityService.getFeed().then((data) => {
      setPosts(data);
      setLoading(false);
    });
  }, [open, refreshKey]);

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={440} title="🌍 自然社区">
      <div style={{ marginBottom: 14 }}>
        <Button type="primary" block onClick={onShareClick}>📸 分享我的发现</Button>
      </div>

      {!CommunityService.available() ? (
        <div className="collection-empty">社区功能需要配置云端后开启</div>
      ) : loading ? (
        <div className="collection-empty">加载中…</div>
      ) : posts.length === 0 ? (
        <div className="collection-empty">
          还没有人分享<br />成为第一个分享自然发现的人吧！🌱
        </div>
      ) : (
        <div className="feed-list">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </Drawer>
  );
}

/** 单条分享卡片 */
export function PostCard({ post }: { post: Post }) {
  const meta = post.taxon ? getTaxonMeta(post.taxon) : null;
  const author = (post.userEmail || '自然爱好者').split('@')[0];
  const date = new Date(post.createdAt).toLocaleDateString('zh-CN');

  return (
    <div className="post-card">
      <img className="post-photo" src={post.photoUrl} alt={post.speciesCn || '分享'} loading="lazy" />
      <div className="post-body">
        <div className="post-head">
          <span className="post-author">🧑‍🌾 {author}</span>
          <span className="post-date">{date}</span>
        </div>
        {post.speciesCn && meta && (
          <Tag size="small" color={meta.color as any} variant="solid">
            {meta.icon} {post.speciesCn}
          </Tag>
        )}
        {post.caption && <p className="post-caption">{post.caption}</p>}
        {post.location && <div className="post-loc">📍 {post.location}</div>}
      </div>
    </div>
  );
}
