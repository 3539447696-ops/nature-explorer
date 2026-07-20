import { Drawer, Button, Card } from 'animal-island-ui';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  collectionCount: number;
  onLoginRequest: () => void;
}

export function UserDrawer({ open, onClose, collectionCount, onLoginRequest }: Props) {
  const { user, signOut, configured } = useAuth();

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={360} title="👤 我的">
      <div className="user-menu">
        {user ? (
          <>
            <div className="u-email">{user.email}</div>
            <Card color="app-green">
              <div style={{ textAlign: 'center', fontWeight: 700 }}>
                🏆 已收集 {collectionCount} 个物种
              </div>
            </Card>
            <div style={{ fontSize: 13, color: 'var(--animal-text-secondary)', textAlign: 'center', margin: '10px 0', lineHeight: 1.7 }}>
              你的图鉴已云端同步 ☁️<br />换设备登录同一账号即可继续收集
            </div>
            <Button block danger onClick={async () => { await signOut(); onClose(); }}>
              退出登录
            </Button>
          </>
        ) : (
          <>
            <Card color="app-yellow">
              <div style={{ textAlign: 'center', fontWeight: 700 }}>
                🌱 当前为{configured ? '未登录' : '本地'}模式
              </div>
            </Card>
            <div style={{ fontSize: 13, color: 'var(--animal-text-secondary)', textAlign: 'center', margin: '10px 0', lineHeight: 1.7 }}>
              已收集 {collectionCount} 个物种（保存在本机）<br />
              {configured ? '登录后可云端同步、多端访问' : '配置云端后可开启账号与同步'}
            </div>
            {configured && (
              <Button type="primary" block onClick={() => { onClose(); onLoginRequest(); }}>
                登录 / 注册
              </Button>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
