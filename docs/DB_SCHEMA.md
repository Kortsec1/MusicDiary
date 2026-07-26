# DB 스키마

```mermaid
erDiagram
  User ||--o{ Session : owns
  User ||--|| SpotifyConnection : connects
  User ||--o{ ListeningEvent : captures
  User ||--o{ DiaryEntry : writes
  User ||--o{ DailyAlbum : compiles
  Album ||--o{ Track : contains
  Track ||--o{ TrackArtist : credits
  Artist ||--o{ TrackArtist : performs
  Track ||--o{ ListeningEvent : played
  Track ||--o{ DiaryEntry : anchors
  DiaryEntry ||--o{ MediaAsset : attaches
  DailyAlbum ||--o{ DailyAlbumItem : orders
```

주요 ID는 UUID, 시간은 UTC로 저장한다. `User + albumDate`, provider ID, listening dedupe key에 unique 제약을 둔다. 사용자 소유 데이터는 계정 삭제 시 cascade되며, 공유 메타데이터 Track/Artist/Album은 의도치 않은 삭제를 막기 위해 restrict/set-null을 사용한다.
