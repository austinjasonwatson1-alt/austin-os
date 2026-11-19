import { Page } from './Page';
import { cabinRooms, Room } from './Rooms';

export default function CabinHome() {
  return (
    <Page
      eyebrow="Writer's Cabin"
      title="Everything for the book, under one roof."
      lede="The lamp is on. Each room below holds one part of the writing life — the live ones work today, the rest are on the build list."
    >
      <div className="grid cols-3">
        {cabinRooms().map((m) => <Room key={m.id} m={m} />)}
      </div>
    </Page>
  );
}
