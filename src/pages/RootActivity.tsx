import { useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Key,
  Globe,
  Trash2,
} from "lucide-react";
import { useStore } from "../state/store";
import {
  ROOT_SANDBOX_API_KEY,
  ROOT_SANDBOX_BASE_URL,
} from "../services/root";

export default function RootActivity() {
  const { state, update } = useStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const entries = state.root.activity;

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function clear() {
    if (!confirm("Clear the Root activity log? (This is UI-only.)")) return;
    update((draft) => {
      draft.root.activity = [];
    });
    setExpanded(new Set());
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity size={22} className="text-indigo-600" />
            Root Activity
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Every myPay action below is mirrored to the Root sandbox.  This is
            the same data you'd see in Root's dashboard.
          </p>
        </div>
        <button
          onClick={clear}
          className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-md px-2.5 py-1.5"
        >
          <Trash2 size={12} /> Clear log
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <InfoRow
          icon={<Globe size={14} />}
          label="Base URL"
          value={ROOT_SANDBOX_BASE_URL}
        />
        <InfoRow
          icon={<Key size={14} />}
          label="API key"
          value={ROOT_SANDBOX_API_KEY}
          secret
        />
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          No Root API activity yet.  Sign in, add an employee, or link a bank
          to get started.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-50">
          {entries.map((e) => {
            const isOpen = expanded.has(e.id);
            return (
              <div key={e.id}>
                <button
                  onClick={() => toggle(e.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50"
                >
                  {isOpen ? (
                    <ChevronDown size={14} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400" />
                  )}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                      e.status === "ok"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {e.status}
                  </span>
                  <code className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    {e.endpoint}
                  </code>
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {e.summary}
                  </span>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">
                    {new Date(e.at).toLocaleTimeString()}
                  </span>
                </button>
                {isOpen && (e.request || e.response) && (
                  <div className="px-5 pb-4 pt-0.5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {e.request !== undefined && (
                      <Block title="Request" data={e.request} />
                    )}
                    {e.response !== undefined && (
                      <Block title="Response" data={e.response} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  secret,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-mono text-gray-800 truncate">
          {show ? value : "••••••••••••••••"}
        </p>
      </div>
      {secret && (
        <button
          onClick={() => setShow(!show)}
          className="text-xs text-indigo-600 hover:text-indigo-700"
        >
          {show ? "Hide" : "Show"}
        </button>
      )}
    </div>
  );
}

function Block({ title, data }: { title: string; data: unknown }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
        {title}
      </p>
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-[11px] overflow-x-auto font-mono">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
