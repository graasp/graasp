import { EtherpadItemService } from '../src/service';

describe('Service helper methods', () => {
  it('builds correct pad ID', () => {
    expect(
      EtherpadItemService.buildPadID({ groupID: 'g.s8oes9dhwrvt0zif', padName: 'test' }),
    ).toEqual('g.s8oes9dhwrvt0zif$test');
  });

  it('builds correct relative pad path', () => {
    expect(EtherpadItemService.buildPadPath({ padID: 'g.s8oes9dhwrvt0zif$test' })).toEqual(
      '/p/g.s8oes9dhwrvt0zif$test',
    );
  });

  it('builds correct absolute pad url', () => {
    expect(
      EtherpadItemService.buildPadPath(
        { padID: 'g.s8oes9dhwrvt0zif$test' },
        'http://localhost:9001',
      ),
    ).toEqual('http://localhost:9001/p/g.s8oes9dhwrvt0zif$test');
  });

  it('builds correct etherpad item extra', () => {
    expect(
      EtherpadItemService.buildEtherpadExtra({ groupID: 'g.s8oes9dhwrvt0zif', padName: 'test' }),
    ).toEqual({
      etherpad: {
        padID: 'g.s8oes9dhwrvt0zif$test',
        groupID: 'g.s8oes9dhwrvt0zif',
      },
    });
  });
});
